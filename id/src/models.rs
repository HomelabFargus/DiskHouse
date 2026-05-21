use rdkafka::producer::FutureProducer;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, sync::Arc};
use tokio::sync::RwLock;

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) producer: FutureProducer,
    pub(crate) http_client: Client,
    pub(crate) keycloak: KeycloakConfig,
    pub(crate) keycloak_admin: KeycloakAdminConfig,
    pub(crate) jwks_cache: Arc<RwLock<Option<JwksDocument>>>,
}

#[derive(Debug, Clone)]
pub(crate) struct KeycloakConfig {
    pub(crate) base_url: String,
    pub(crate) realm: String,
    pub(crate) client_id: String,
    pub(crate) client_secret: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct KeycloakAdminConfig {
    pub(crate) base_url: String,
    pub(crate) admin_realm: String,
    pub(crate) username: String,
    pub(crate) password: String,
    pub(crate) client_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct WorkflowEvent {
    pub(crate) request_id: String,
    #[serde(default)]
    pub(crate) identity: Option<UserIdentity>,
    pub(crate) outputs: Vec<StageOutput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct StageOutput {
    pub(crate) service: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct FrontendUpdate {
    pub(crate) request_id: String,
    pub(crate) service: String,
    pub(crate) message: String,
    pub(crate) outputs: Vec<StageOutput>,
    pub(crate) complete: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct StartRequest {
    pub(crate) request_id: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LoginRequest {
    pub(crate) username: String,
    pub(crate) password: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RefreshRequest {
    pub(crate) refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct TokenResponse {
    pub(crate) access_token: String,
    pub(crate) expires_in: u64,
    pub(crate) refresh_expires_in: Option<u64>,
    pub(crate) refresh_token: Option<String>,
    pub(crate) token_type: String,
    pub(crate) scope: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct UserInfoResponse {
    pub(crate) sub: String,
    pub(crate) preferred_username: Option<String>,
    pub(crate) email: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) groups: Vec<String>,
    pub(crate) realm_roles: Vec<String>,
    pub(crate) client_roles: Vec<String>,
    pub(crate) is_admin: bool,
}

#[derive(Debug, Serialize)]
pub(crate) struct AdminUserResponse {
    pub(crate) id: String,
    pub(crate) username: String,
    pub(crate) email: Option<String>,
    pub(crate) first_name: Option<String>,
    pub(crate) last_name: Option<String>,
    pub(crate) enabled: bool,
    pub(crate) email_verified: bool,
    pub(crate) groups: Vec<String>,
    pub(crate) is_admin: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AdminUserCreateRequest {
    pub(crate) username: String,
    pub(crate) email: Option<String>,
    pub(crate) first_name: Option<String>,
    pub(crate) last_name: Option<String>,
    pub(crate) enabled: Option<bool>,
    pub(crate) password: String,
    pub(crate) is_admin: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AdminUserUpdateRequest {
    pub(crate) username: String,
    pub(crate) email: Option<String>,
    pub(crate) first_name: Option<String>,
    pub(crate) last_name: Option<String>,
    pub(crate) enabled: Option<bool>,
    pub(crate) password: Option<String>,
    pub(crate) is_admin: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct KeycloakUserRepresentation {
    pub(crate) id: Option<String>,
    pub(crate) username: Option<String>,
    pub(crate) email: Option<String>,
    #[serde(rename = "firstName")]
    pub(crate) first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub(crate) last_name: Option<String>,
    pub(crate) enabled: Option<bool>,
    #[serde(rename = "emailVerified")]
    pub(crate) email_verified: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct KeycloakGroupRepresentation {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct KeycloakCredentialRepresentation {
    #[serde(rename = "type")]
    pub(crate) type_name: String,
    pub(crate) value: String,
    pub(crate) temporary: bool,
}

#[derive(Debug, Serialize)]
pub(crate) struct KeycloakUserUpsertRepresentation {
    pub(crate) username: String,
    pub(crate) email: Option<String>,
    #[serde(rename = "firstName")]
    pub(crate) first_name: Option<String>,
    #[serde(rename = "lastName")]
    pub(crate) last_name: Option<String>,
    pub(crate) enabled: bool,
    pub(crate) credentials: Vec<KeycloakCredentialRepresentation>,
}

#[derive(Debug, Serialize)]
pub(crate) struct KeycloakPasswordResetRepresentation {
    #[serde(rename = "type")]
    pub(crate) type_name: String,
    pub(crate) value: String,
    pub(crate) temporary: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AdminTokenResponse {
    pub(crate) access_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct UserIdentity {
    pub(crate) sub: String,
    pub(crate) preferred_username: Option<String>,
    pub(crate) email: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) groups: Vec<String>,
    pub(crate) realm_roles: Vec<String>,
    pub(crate) client_roles: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct JwtClaims {
    pub(crate) sub: String,
    pub(crate) exp: usize,
    pub(crate) iss: String,
    pub(crate) azp: Option<String>,
    pub(crate) aud: AudienceClaim,
    pub(crate) preferred_username: Option<String>,
    pub(crate) email: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) groups: Option<Vec<String>>,
    pub(crate) realm_access: Option<RoleAccess>,
    pub(crate) resource_access: Option<std::collections::HashMap<String, RoleAccess>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub(crate) enum AudienceClaim {
    Single(String),
    Multiple(Vec<String>),
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct RoleAccess {
    pub(crate) roles: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct JwksDocument {
    pub(crate) keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Jwk {
    pub(crate) kid: Option<String>,
    pub(crate) kty: String,
    pub(crate) alg: Option<String>,
    pub(crate) n: Option<String>,
    pub(crate) e: Option<String>,
}

impl KeycloakConfig {
    pub(crate) fn realm_base_url(&self) -> String {
        format!(
            "{}/realms/{}",
            self.base_url.trim_end_matches('/'),
            self.realm
        )
    }

    pub(crate) fn issuer(&self) -> String {
        self.realm_base_url()
    }

    pub(crate) fn auth_url(&self) -> String {
        format!("{}/protocol/openid-connect/auth", self.realm_base_url())
    }

    pub(crate) fn token_url(&self) -> String {
        format!("{}/protocol/openid-connect/token", self.realm_base_url())
    }

    pub(crate) fn jwks_url(&self) -> String {
        format!("{}/protocol/openid-connect/certs", self.realm_base_url())
    }

    fn admin_realm_base_url(&self) -> String {
        format!(
            "{}/admin/realms/{}",
            self.base_url.trim_end_matches('/'),
            self.realm
        )
    }

    pub(crate) fn users_admin_url(&self) -> String {
        format!("{}/users", self.admin_realm_base_url())
    }

    pub(crate) fn user_admin_url(&self, user_id: &str) -> String {
        format!("{}/users/{}", self.admin_realm_base_url(), user_id)
    }

    pub(crate) fn user_groups_admin_url(&self, user_id: &str) -> String {
        format!("{}/groups", self.user_admin_url(user_id))
    }

    pub(crate) fn user_password_admin_url(&self, user_id: &str) -> String {
        format!("{}/reset-password", self.user_admin_url(user_id))
    }

    pub(crate) fn groups_admin_url(&self) -> String {
        format!("{}/groups", self.admin_realm_base_url())
    }

    pub(crate) fn user_group_membership_url(&self, user_id: &str, group_id: &str) -> String {
        format!("{}/groups/{}", self.user_admin_url(user_id), group_id)
    }
}

impl KeycloakAdminConfig {
    fn realm_base_url(&self) -> String {
        format!(
            "{}/realms/{}",
            self.base_url.trim_end_matches('/'),
            self.admin_realm
        )
    }

    pub(crate) fn token_url(&self) -> String {
        format!("{}/protocol/openid-connect/token", self.realm_base_url())
    }
}

impl AudienceClaim {
    #[allow(dead_code)]
    pub(crate) fn values(&self) -> HashSet<&str> {
        match self {
            AudienceClaim::Single(value) => HashSet::from([value.as_str()]),
            AudienceClaim::Multiple(values) => values.iter().map(String::as_str).collect(),
        }
    }
}

impl UserIdentity {
    pub(crate) fn from_claims(client_id: &str, claims: &JwtClaims) -> Self {
        Self {
            sub: claims.sub.clone(),
            preferred_username: claims.preferred_username.clone(),
            email: claims.email.clone(),
            name: claims.name.clone(),
            groups: claims.groups.clone().unwrap_or_default(),
            realm_roles: claims
                .realm_access
                .as_ref()
                .map(|access| access.roles.clone())
                .unwrap_or_default(),
            client_roles: claims
                .resource_access
                .as_ref()
                .and_then(|access| access.get(client_id))
                .map(|access| access.roles.clone())
                .unwrap_or_default(),
        }
    }
}
