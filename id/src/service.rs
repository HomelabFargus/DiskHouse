use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    routing::{get, post, put},
    Json, Router,
};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use rdkafka::{
    config::ClientConfig,
    consumer::{Consumer, StreamConsumer},
    message::Message,
    producer::{FutureProducer, FutureRecord},
    util::Timeout,
};
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::{env, sync::Arc, time::Duration};
use tokio::{net::TcpListener, time::sleep};
use tower_http::trace::TraceLayer;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    constants::{
        AppError, DEFAULT_BROKERS, DEFAULT_KEYCLOAK_ADMIN_CLIENT_ID,
        DEFAULT_KEYCLOAK_ADMIN_PASSWORD, DEFAULT_KEYCLOAK_ADMIN_REALM,
        DEFAULT_KEYCLOAK_ADMIN_USERNAME, DEFAULT_KEYCLOAK_BASE_URL, DEFAULT_KEYCLOAK_CLIENT_ID,
        DEFAULT_KEYCLOAK_REALM, FRONTEND_TOPIC, INPUT_TOPIC, OUTPUT_TOPIC, PORT, SERVICE_NAME,
    },
    models::{
        AdminTokenResponse, AdminUserCreateRequest, AdminUserResponse, AdminUserUpdateRequest,
        AppState, AudienceClaim, FrontendUpdate, JwksDocument, JwtClaims, KeycloakAdminConfig,
        KeycloakConfig, KeycloakCredentialRepresentation, KeycloakGroupRepresentation,
        KeycloakPasswordResetRepresentation, KeycloakUserRepresentation,
        KeycloakUserUpsertRepresentation, LoginRequest, RefreshRequest, StageOutput,
        StartRequest, TokenResponse, UserIdentity, UserInfoResponse, WorkflowEvent,
    },
};
use tokio::sync::RwLock;

pub(crate) async fn run() -> Result<(), AppError> {
    init_tracing("info");

    let brokers = kafka_brokers();
    let producer = create_producer(&brokers)?;
    let http_client = Client::builder().build()?;
    let keycloak = keycloak_config();
    let keycloak_admin = keycloak_admin_config();

    spawn_workflow_consumer(brokers.clone(), producer.clone());

    let app = Router::new()
        .route("/", get(root))
        .route("/request", post(start_request))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/me", get(me))
        .route("/auth/config", get(auth_config))
        .route("/admin/users", get(list_users).post(create_user))
        .route("/admin/users/:user_id", put(update_user).delete(delete_user))
        .with_state(Arc::new(AppState {
            producer,
            http_client,
            keycloak,
            keycloak_admin,
            jwks_cache: Arc::new(RwLock::new(None)),
        }))
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind(("0.0.0.0", PORT))
        .await
        .expect("failed to bind id service");

    info!(service = SERVICE_NAME, port = PORT, "service started");

    axum::serve(listener, app)
        .await
        .expect("failed to serve id service");

    Ok(())
}

fn init_tracing(default_level: &str) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(format!("{default_level},tower_http={default_level}")));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_target(true))
        .init();
}

fn kafka_brokers() -> String {
    env::var("KAFKA_BROKERS").unwrap_or_else(|_| DEFAULT_BROKERS.to_owned())
}

fn keycloak_config() -> KeycloakConfig {
    KeycloakConfig {
        base_url: env::var("KEYCLOAK_BASE_URL")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_BASE_URL.to_owned()),
        realm: env::var("KEYCLOAK_REALM").unwrap_or_else(|_| DEFAULT_KEYCLOAK_REALM.to_owned()),
        client_id: env::var("KEYCLOAK_CLIENT_ID")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_CLIENT_ID.to_owned()),
        client_secret: env::var("KEYCLOAK_CLIENT_SECRET").ok(),
    }
}

fn keycloak_admin_config() -> KeycloakAdminConfig {
    KeycloakAdminConfig {
        base_url: env::var("KEYCLOAK_BASE_URL")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_BASE_URL.to_owned()),
        admin_realm: env::var("KEYCLOAK_ADMIN_REALM")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_ADMIN_REALM.to_owned()),
        username: env::var("KEYCLOAK_ADMIN_USERNAME")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_ADMIN_USERNAME.to_owned()),
        password: env::var("KEYCLOAK_ADMIN_PASSWORD")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_ADMIN_PASSWORD.to_owned()),
        client_id: env::var("KEYCLOAK_ADMIN_CLIENT_ID")
            .unwrap_or_else(|_| DEFAULT_KEYCLOAK_ADMIN_CLIENT_ID.to_owned()),
    }
}

fn create_producer(brokers: &str) -> Result<FutureProducer, AppError> {
    Ok(ClientConfig::new()
        .set("bootstrap.servers", brokers)
        .set("message.timeout.ms", "5000")
        .create()?)
}

fn create_consumer(brokers: &str, group_id: &str) -> Result<StreamConsumer, AppError> {
    Ok(ClientConfig::new()
        .set("group.id", group_id)
        .set("bootstrap.servers", brokers)
        .set("enable.auto.commit", "true")
        .set("auto.offset.reset", "earliest")
        .create()?)
}

fn spawn_workflow_consumer(brokers: String, producer: FutureProducer) {
    tokio::spawn(async move {
        loop {
            let consumer = match create_consumer(&brokers, "id-service-group") {
                Ok(consumer) => consumer,
                Err(err) => {
                    error!(service = SERVICE_NAME, error = %err, "failed to create kafka consumer");
                    sleep(Duration::from_secs(2)).await;
                    continue;
                }
            };

            if let Err(err) = consumer.subscribe(&[INPUT_TOPIC]) {
                error!(service = SERVICE_NAME, error = %err, "failed to subscribe to kafka topic");
                sleep(Duration::from_secs(2)).await;
                continue;
            }

            info!(service = SERVICE_NAME, topic = INPUT_TOPIC, "kafka consumer subscribed");

            loop {
                match consumer.recv().await {
                    Ok(message) => {
                        let Some(payload) = message.payload_view::<str>().and_then(Result::ok) else {
                            continue;
                        };

                        if let Err(err) =
                            handle_workflow_event(payload.to_owned(), producer.clone()).await
                        {
                            error!(service = SERVICE_NAME, error = %err, "failed to process workflow event");
                        }
                    }
                    Err(err) => {
                        error!(service = SERVICE_NAME, error = %err, "kafka receive error");
                        sleep(Duration::from_secs(2)).await;
                        break;
                    }
                }
            }
        }
    });
}

async fn handle_workflow_event(payload: String, producer: FutureProducer) -> Result<(), AppError> {
    let mut event: WorkflowEvent = serde_json::from_str(&payload)?;
    let message = "ID service: запрос принят и пользователь идентифицирован".to_owned();

    info!(
        service = SERVICE_NAME,
        request_id = %event.request_id,
        "processing workflow event"
    );

    event.outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    publish_frontend_update(&producer, &event, SERVICE_NAME, &message, false).await?;
    publish_event(&producer, OUTPUT_TOPIC, &event.request_id, &event).await?;

    Ok(())
}

async fn start_request(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<StartRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let claims = authenticate_request(&state, &headers).await?;

    let event = WorkflowEvent {
        request_id: payload.request_id.clone(),
        identity: Some(UserIdentity::from_claims(&state.keycloak.client_id, &claims)),
        outputs: Vec::new(),
    };

    publish_event(&state.producer, INPUT_TOPIC, &payload.request_id, &event)
        .await
        .map_err(internal_error)?;

    info!(
        service = SERVICE_NAME,
        request_id = %payload.request_id,
        subject = %claims.sub,
        "workflow request accepted"
    );

    Ok(Json(json!({
        "requestId": payload.request_id,
        "status": "accepted"
    })))
}

async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    let token = keycloak_token_request(
        &state,
        &[
            ("grant_type", "password".to_owned()),
            ("username", payload.username),
            ("password", payload.password),
        ],
    )
    .await?;

    Ok(Json(token))
}

async fn refresh(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    let token = keycloak_token_request(
        &state,
        &[
            ("grant_type", "refresh_token".to_owned()),
            ("refresh_token", payload.refresh_token),
        ],
    )
    .await?;

    Ok(Json(token))
}

async fn me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<UserInfoResponse>, (StatusCode, String)> {
    let claims = authenticate_request(&state, &headers).await?;
    let is_admin = resolve_admin_access(&state, &claims).await;

    Ok(Json(UserInfoResponse {
        sub: claims.sub,
        preferred_username: claims.preferred_username,
        email: claims.email,
        name: claims.name,
        groups: claims.groups.unwrap_or_default(),
        realm_roles: claims
            .realm_access
            .map(|access| access.roles)
            .unwrap_or_default(),
        client_roles: claims
            .resource_access
            .and_then(|access| access.get(&state.keycloak.client_id).cloned())
            .map(|access| access.roles)
            .unwrap_or_default(),
        is_admin,
    }))
}

async fn list_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminUserResponse>>, (StatusCode, String)> {
    let claims = authenticate_request(&state, &headers).await?;
    ensure_admin_claims(&state, &claims).await?;

    let users = fetch_admin_users(&state).await?;
    Ok(Json(users))
}

async fn create_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<AdminUserCreateRequest>,
) -> Result<(StatusCode, Json<AdminUserResponse>), (StatusCode, String)> {
    let claims = authenticate_request(&state, &headers).await?;
    ensure_admin_claims(&state, &claims).await?;

    let created = create_keycloak_user(&state, payload).await?;
    Ok((StatusCode::CREATED, Json(created)))
}

async fn update_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<String>,
    Json(payload): Json<AdminUserUpdateRequest>,
) -> Result<Json<AdminUserResponse>, (StatusCode, String)> {
    let claims = authenticate_request(&state, &headers).await?;
    ensure_admin_claims(&state, &claims).await?;

    let updated = update_keycloak_user(&state, &user_id, payload).await?;
    Ok(Json(updated))
}

async fn delete_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let claims = authenticate_request(&state, &headers).await?;
    ensure_admin_claims(&state, &claims).await?;

    delete_keycloak_user(&state, &user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn auth_config(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "realm": state.keycloak.realm.clone(),
        "clientId": state.keycloak.client_id.clone(),
        "issuer": state.keycloak.issuer(),
        "authUrl": state.keycloak.auth_url(),
        "tokenUrl": state.keycloak.token_url(),
    }))
}

async fn fetch_admin_users(state: &Arc<AppState>) -> Result<Vec<AdminUserResponse>, (StatusCode, String)> {
    let admin_token = get_keycloak_admin_token(state).await?;
    let response = state
        .http_client
        .get(state.keycloak.users_admin_url())
        .bearer_auth(&admin_token)
        .query(&[("max", "100"), ("briefRepresentation", "false")])
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    let users = response
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to load users"))?
        .json::<Vec<KeycloakUserRepresentation>>()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    let mut result = Vec::with_capacity(users.len());
    for user in users {
        let Some(user_id) = user.id.clone() else {
            continue;
        };

        let groups = fetch_user_groups(state, &admin_token, &user_id).await?;
        result.push(map_admin_user(user, groups));
    }

    result.sort_by(|left, right| left.username.cmp(&right.username));
    Ok(result)
}

async fn create_keycloak_user(
    state: &Arc<AppState>,
    payload: AdminUserCreateRequest,
) -> Result<AdminUserResponse, (StatusCode, String)> {
    let admin_token = get_keycloak_admin_token(state).await?;
    let username = payload.username.trim().to_owned();
    let password = payload.password.trim().to_owned();

    if username.is_empty() || password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "username and password are required".to_owned()));
    }

    let representation = KeycloakUserUpsertRepresentation {
        username,
        email: normalize_optional_string(payload.email),
        first_name: normalize_optional_string(payload.first_name),
        last_name: normalize_optional_string(payload.last_name),
        enabled: payload.enabled.unwrap_or(true),
        credentials: vec![KeycloakCredentialRepresentation {
            type_name: "password".to_owned(),
            value: password,
            temporary: false,
        }],
    };

    let response = state
        .http_client
        .post(state.keycloak.users_admin_url())
        .bearer_auth(&admin_token)
        .json(&representation)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    let response = response
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to create user"))?;

    let created_user_id = extract_created_user_id(&response)?;
    sync_admin_group_membership(
        state,
        &admin_token,
        &created_user_id,
        payload.is_admin.unwrap_or(false),
    )
    .await?;

    fetch_single_admin_user(state, &admin_token, &created_user_id).await
}

async fn update_keycloak_user(
    state: &Arc<AppState>,
    user_id: &str,
    payload: AdminUserUpdateRequest,
) -> Result<AdminUserResponse, (StatusCode, String)> {
    let admin_token = get_keycloak_admin_token(state).await?;
    let username = payload.username.trim().to_owned();

    if username.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "username is required".to_owned()));
    }

    let representation = KeycloakUserUpsertRepresentation {
        username,
        email: normalize_optional_string(payload.email),
        first_name: normalize_optional_string(payload.first_name),
        last_name: normalize_optional_string(payload.last_name),
        enabled: payload.enabled.unwrap_or(true),
        credentials: Vec::new(),
    };

    state
        .http_client
        .put(state.keycloak.user_admin_url(user_id))
        .bearer_auth(&admin_token)
        .json(&representation)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to update user"))?;

    if let Some(password) = payload.password.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }) {
        state
            .http_client
            .put(state.keycloak.user_password_admin_url(user_id))
            .bearer_auth(&admin_token)
            .json(&KeycloakPasswordResetRepresentation {
                type_name: "password".to_owned(),
                value: password,
                temporary: false,
            })
            .send()
            .await
            .map_err(|err| internal_error(Box::new(err)))?
            .error_for_status()
            .map_err(|err| map_keycloak_admin_error(err, "failed to reset password"))?;
    }

    sync_admin_group_membership(
        state,
        &admin_token,
        user_id,
        payload.is_admin.unwrap_or(false),
    )
    .await?;

    fetch_single_admin_user(state, &admin_token, user_id).await
}

async fn delete_keycloak_user(
    state: &Arc<AppState>,
    user_id: &str,
) -> Result<(), (StatusCode, String)> {
    let admin_token = get_keycloak_admin_token(state).await?;
    state
        .http_client
        .delete(state.keycloak.user_admin_url(user_id))
        .bearer_auth(admin_token)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to delete user"))?;

    Ok(())
}

async fn fetch_single_admin_user(
    state: &Arc<AppState>,
    admin_token: &str,
    user_id: &str,
) -> Result<AdminUserResponse, (StatusCode, String)> {
    let user = state
        .http_client
        .get(state.keycloak.user_admin_url(user_id))
        .bearer_auth(admin_token)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to load user"))?
        .json::<KeycloakUserRepresentation>()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    let groups = fetch_user_groups(state, admin_token, user_id).await?;
    Ok(map_admin_user(user, groups))
}

async fn fetch_user_groups(
    state: &Arc<AppState>,
    admin_token: &str,
    user_id: &str,
) -> Result<Vec<KeycloakGroupRepresentation>, (StatusCode, String)> {
    state
        .http_client
        .get(state.keycloak.user_groups_admin_url(user_id))
        .bearer_auth(admin_token)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to load user groups"))?
        .json::<Vec<KeycloakGroupRepresentation>>()
        .await
        .map_err(|err| internal_error(Box::new(err)))
}

async fn sync_admin_group_membership(
    state: &Arc<AppState>,
    admin_token: &str,
    user_id: &str,
    should_be_admin: bool,
) -> Result<(), (StatusCode, String)> {
    let admin_group = fetch_admin_group(state, admin_token).await?;
    let groups = fetch_user_groups(state, admin_token, user_id).await?;
    let is_member = groups.iter().any(|group| group.id == admin_group.id);

    if should_be_admin && !is_member {
        state
            .http_client
            .put(state.keycloak.user_group_membership_url(user_id, &admin_group.id))
            .bearer_auth(admin_token)
            .json(&admin_group)
            .send()
            .await
            .map_err(|err| internal_error(Box::new(err)))?
            .error_for_status()
            .map_err(|err| map_keycloak_admin_error(err, "failed to add user to Admin group"))?;
    }

    if !should_be_admin && is_member {
        state
            .http_client
            .delete(state.keycloak.user_group_membership_url(user_id, &admin_group.id))
            .bearer_auth(admin_token)
            .send()
            .await
            .map_err(|err| internal_error(Box::new(err)))?
            .error_for_status()
            .map_err(|err| map_keycloak_admin_error(err, "failed to remove user from Admin group"))?;
    }

    Ok(())
}

async fn fetch_admin_group(
    state: &Arc<AppState>,
    admin_token: &str,
) -> Result<KeycloakGroupRepresentation, (StatusCode, String)> {
    let groups = state
        .http_client
        .get(state.keycloak.groups_admin_url())
        .bearer_auth(admin_token)
        .query(&[("search", "Admin"), ("briefRepresentation", "false")])
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to load groups"))?
        .json::<Vec<KeycloakGroupRepresentation>>()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    groups
        .into_iter()
        .find(|group| group.name == "Admin" || group.path.as_deref() == Some("/Admin"))
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                "Keycloak group `Admin` was not found".to_owned(),
            )
        })
}

async fn get_keycloak_admin_token(state: &Arc<AppState>) -> Result<String, (StatusCode, String)> {
    let params = [
        ("grant_type", "password".to_owned()),
        ("client_id", state.keycloak_admin.client_id.clone()),
        ("username", state.keycloak_admin.username.clone()),
        ("password", state.keycloak_admin.password.clone()),
    ];

    let response = state
        .http_client
        .post(state.keycloak_admin.token_url())
        .form(&params)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    let response = response
        .error_for_status()
        .map_err(|err| map_keycloak_admin_error(err, "failed to authenticate in Keycloak admin API"))?;

    response
        .json::<AdminTokenResponse>()
        .await
        .map(|token| token.access_token)
        .map_err(|err| internal_error(Box::new(err)))
}

fn map_admin_user(
    user: KeycloakUserRepresentation,
    groups: Vec<KeycloakGroupRepresentation>,
) -> AdminUserResponse {
    let normalized_groups = groups
        .iter()
        .map(|group| group.path.clone().unwrap_or_else(|| format!("/{}", group.name)))
        .collect::<Vec<_>>();

    let is_admin = normalized_groups
        .iter()
        .any(|group| group.trim_start_matches('/') == "Admin");

    AdminUserResponse {
        id: user.id.unwrap_or_default(),
        username: user.username.unwrap_or_else(|| "unknown".to_owned()),
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        enabled: user.enabled.unwrap_or(true),
        email_verified: user.email_verified.unwrap_or(false),
        groups: normalized_groups,
        is_admin,
    }
}

fn extract_created_user_id(response: &reqwest::Response) -> Result<String, (StatusCode, String)> {
    let location = response
        .headers()
        .get(header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                "Keycloak did not return created user location".to_owned(),
            )
        })?;

    location
        .rsplit('/')
        .next()
        .map(str::to_owned)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                "Failed to extract created user id".to_owned(),
            )
        })
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn claims_is_admin(client_id: &str, claims: &JwtClaims) -> bool {
    let in_admin_group = claims
        .groups
        .as_ref()
        .map(|groups| {
            groups
                .iter()
                .any(|group| group.trim_start_matches('/') == "Admin")
        })
        .unwrap_or(false);

    let has_realm_admin_role = claims
        .realm_access
        .as_ref()
        .map(|access| access.roles.iter().any(|role| matches_admin_role(role)))
        .unwrap_or(false);

    let has_client_admin_role = claims
        .resource_access
        .as_ref()
        .and_then(|access| access.get(client_id))
        .map(|access| access.roles.iter().any(|role| matches_admin_role(role)))
        .unwrap_or(false);

    in_admin_group || has_realm_admin_role || has_client_admin_role
}

async fn resolve_admin_access(state: &Arc<AppState>, claims: &JwtClaims) -> bool {
    if claims_is_admin(&state.keycloak.client_id, claims) {
        return true;
    }

    let admin_token = match get_keycloak_admin_token(state).await {
        Ok(token) => token,
        Err(_) => return false,
    };

    let groups = match fetch_user_groups(state, &admin_token, &claims.sub).await {
        Ok(groups) => groups,
        Err(_) => return false,
    };

    groups
        .iter()
        .any(|group| group.name == "Admin" || group.path.as_deref() == Some("/Admin"))
}

async fn ensure_admin_claims(
    state: &Arc<AppState>,
    claims: &JwtClaims,
) -> Result<(), (StatusCode, String)> {
    if resolve_admin_access(state, claims).await {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, "admin access required".to_owned()))
    }
}

fn matches_admin_role(role: &str) -> bool {
    matches!(role, "admin" | "Admin" | "manage-users" | "query-users" | "view-users")
}

fn map_keycloak_admin_error(err: reqwest::Error, fallback: &str) -> (StatusCode, String) {
    if let Some(status) = err.status() {
        let mapped_status = match status {
            reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => StatusCode::FORBIDDEN,
            reqwest::StatusCode::NOT_FOUND => StatusCode::NOT_FOUND,
            reqwest::StatusCode::BAD_REQUEST | reqwest::StatusCode::CONFLICT => StatusCode::BAD_REQUEST,
            _ => StatusCode::BAD_GATEWAY,
        };

        return (mapped_status, fallback.to_owned());
    }

    internal_error(Box::new(err))
}

async fn publish_frontend_update(
    producer: &FutureProducer,
    event: &WorkflowEvent,
    service: &str,
    message: &str,
    complete: bool,
) -> Result<(), AppError> {
    let update = FrontendUpdate {
        request_id: event.request_id.clone(),
        service: service.to_owned(),
        message: message.to_owned(),
        outputs: event.outputs.clone(),
        complete,
    };

    publish_event(producer, FRONTEND_TOPIC, &event.request_id, &update).await
}

async fn publish_event<T: Serialize>(
    producer: &FutureProducer,
    topic: &str,
    key: &str,
    payload: &T,
) -> Result<(), AppError> {
    let body = serde_json::to_string(payload)?;

    producer
        .send(
            FutureRecord::to(topic).payload(&body).key(key),
            Timeout::Never,
        )
        .await
        .map_err(|(err, _)| -> AppError { Box::new(err) })?;

    Ok(())
}

async fn authenticate_request(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<JwtClaims, (StatusCode, String)> {
    let token = extract_bearer_token(headers)?;
    validate_access_token(state, token).await
}

fn extract_bearer_token(headers: &HeaderMap) -> Result<&str, (StatusCode, String)> {
    let header_value = headers
        .get(header::AUTHORIZATION)
        .ok_or_else(|| unauthorized("missing Authorization header"))?;

    let value = header_value
        .to_str()
        .map_err(|_| unauthorized("invalid Authorization header"))?;

    value
        .strip_prefix("Bearer ")
        .ok_or_else(|| unauthorized("expected Bearer token"))
}

async fn validate_access_token(
    state: &Arc<AppState>,
    token: &str,
) -> Result<JwtClaims, (StatusCode, String)> {
    let header = decode_header(token).map_err(|_| unauthorized("invalid JWT header"))?;
    let kid = header
        .kid
        .ok_or_else(|| unauthorized("JWT header does not contain kid"))?;

    let jwks = get_jwks(state).await.map_err(internal_error)?;
    let jwk = jwks
        .keys
        .iter()
        .find(|key| key.kid.as_deref() == Some(kid.as_str()))
        .ok_or_else(|| unauthorized("no matching JWKS key for token"))?;

    if jwk.kty != "RSA" {
        return Err(unauthorized("unsupported JWKS key type"));
    }

    if let Some(alg) = &jwk.alg {
        if alg != "RS256" {
            return Err(unauthorized("unsupported JWT algorithm"));
        }
    }

    let decoding_key = DecodingKey::from_rsa_components(
        jwk.n.as_deref()
            .ok_or_else(|| unauthorized("JWKS key is missing modulus"))?,
        jwk.e.as_deref()
            .ok_or_else(|| unauthorized("JWKS key is missing exponent"))?,
    )
    .map_err(|_| unauthorized("failed to build decoding key"))?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[state.keycloak.issuer()]);
    validation.validate_aud = false;

    let token_data =
        decode::<JwtClaims>(token, &decoding_key, &validation).map_err(|_| unauthorized("token validation failed"))?;

    ensure_token_for_client(&state.keycloak.client_id, &token_data.claims)?;

    Ok(token_data.claims)
}

fn ensure_token_for_client(
    expected_client_id: &str,
    claims: &JwtClaims,
) -> Result<(), (StatusCode, String)> {
    let azp_matches = claims
        .azp
        .as_deref()
        .map(|value| value == expected_client_id)
        .unwrap_or(false);

    let aud_matches = match &claims.aud {
        AudienceClaim::Single(aud) => aud == expected_client_id,
        AudienceClaim::Multiple(values) => values.iter().any(|value| value == expected_client_id),
    };

    if azp_matches || aud_matches {
        Ok(())
    } else {
        Err(unauthorized("token is not issued for configured client"))
    }
}

async fn get_jwks(state: &Arc<AppState>) -> Result<JwksDocument, AppError> {
    if let Some(cached) = state.jwks_cache.read().await.clone() {
        return Ok(cached);
    }

    let response = state
        .http_client
        .get(state.keycloak.jwks_url())
        .send()
        .await?
        .error_for_status()?;

    let jwks = response.json::<JwksDocument>().await?;
    *state.jwks_cache.write().await = Some(jwks.clone());

    Ok(jwks)
}

async fn keycloak_token_request(
    state: &Arc<AppState>,
    extra_params: &[(&str, String)],
) -> Result<TokenResponse, (StatusCode, String)> {
    let mut params = vec![("client_id", state.keycloak.client_id.clone())];
    params.extend_from_slice(extra_params);

    if let Some(secret) = &state.keycloak.client_secret {
        params.push(("client_secret", secret.clone()));
    }

    let response = state
        .http_client
        .post(state.keycloak.token_url())
        .form(&params)
        .send()
        .await
        .map_err(|err| internal_error(Box::new(err)))?;

    if response.status().is_success() {
        let token = response
            .json::<TokenResponse>()
            .await
            .map_err(|err| internal_error(Box::new(err)))?;
        return Ok(token);
    }

    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "failed to read keycloak error response".to_owned());

    error!(
        service = SERVICE_NAME,
        keycloak_status = %status,
        response = %body,
        "keycloak token request failed"
    );

    Err((
        StatusCode::UNAUTHORIZED,
        "keycloak rejected authentication request".to_owned(),
    ))
}

fn unauthorized(message: impl Into<String>) -> (StatusCode, String) {
    (StatusCode::UNAUTHORIZED, message.into())
}

fn internal_error(err: AppError) -> (StatusCode, String) {
    error!(service = SERVICE_NAME, error = %err, "request handling failed");
    (StatusCode::BAD_GATEWAY, err.to_string())
}

async fn root() -> Json<Value> {
    info!(service = SERVICE_NAME, path = "/", "healthcheck handled");
    Json(json!({ "200": "ok" }))
}
