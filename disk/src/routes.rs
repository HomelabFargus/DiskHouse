use axum::{
    extract::{Query, State},
    Json,
};
use futures::TryStreamExt;
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::info;

use crate::{
    constants::{PERSONAL_TOPIC, SERVICE_NAME},
    infra::{display_name, internal_error},
    monitoring::build_monitoring_response,
    models::{
        AppState, CreateDiskRequest, CreateDiskResponse, DeleteDiskQuery, DiskDocument, DiskPayload,
        DiskSummary, IoMonitoringResponse, ListDisksQuery, StageOutput, UpdateDiskOwnerRequest,
        UserIdentity, WorkflowEvent, WorkflowOperation,
    },
    workflow::{publish_event, publish_frontend_update},
};

pub(crate) async fn create_disk(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateDiskRequest>,
) -> Result<Json<CreateDiskResponse>, (axum::http::StatusCode, String)> {
    let disk_id = format!("disk-{}", payload.request_id);
    let owner_display = display_name(&payload.identity);
    let now = DateTime::now();

    let document = DiskDocument {
        disk_id: disk_id.clone(),
        name: payload.disk.name.clone(),
        size_gb: payload.disk.size_gb,
        filesystem: payload.disk.filesystem.clone(),
        performance_tier: payload.disk.performance_tier.clone(),
        owner_sub: payload.identity.sub.clone(),
        owner_display: owner_display.clone(),
        status: "provisioning".to_owned(),
        iscsi_status: "pending".to_owned(),
        source_service: SERVICE_NAME.to_owned(),
        last_request_id: payload.request_id.clone(),
        iscsi: None,
        created_at: now,
        updated_at: DateTime::now(),
    };

    state
        .disks
        .insert_one(document)
        .await
        .map_err(internal_error)?;

    let disk = DiskPayload {
        disk_id: disk_id.clone(),
        name: payload.disk.name,
        size_gb: payload.disk.size_gb,
        filesystem: payload.disk.filesystem,
        performance_tier: payload.disk.performance_tier,
        owner_sub: payload.identity.sub.clone(),
        owner_display,
        status: "provisioning".to_owned(),
        iscsi_status: "pending".to_owned(),
    };

    let mut event = WorkflowEvent {
        request_id: payload.request_id.clone(),
        operation: WorkflowOperation::Create,
        identity: Some(payload.identity),
        disk: Some(disk.clone()),
        outputs: Vec::new(),
    };

    let message = format!(
        "Disk service: диск {} ({}) создан в MongoDB и передан в personal/ISCSI pipeline",
        disk.name, disk.disk_id
    );

    event.outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    publish_frontend_update(&state.producer, &event, &message, false)
        .await
        .map_err(internal_error)?;
    publish_event(&state.producer, PERSONAL_TOPIC, &event.request_id, &event)
        .await
        .map_err(internal_error)?;

    Ok(Json(CreateDiskResponse {
        request_id: payload.request_id,
        disk_id,
        status: "accepted".to_owned(),
    }))
}

pub(crate) async fn list_disks(
    Query(query): Query<ListDisksQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DiskSummary>>, (axum::http::StatusCode, String)> {
    let filter = match query.owner_sub {
        Some(owner_sub) => doc! {
            "owner_sub": owner_sub,
            "status": { "$ne": "deleted" }
        },
        None => doc! {
            "status": { "$ne": "deleted" }
        },
    };

    let mut cursor = state
        .disks
        .find(filter)
        .sort(doc! { "updated_at": -1_i32 })
        .limit(50)
        .await
        .map_err(internal_error)?;

    let mut items = Vec::new();
    while let Some(disk) = cursor.try_next().await.map_err(internal_error)? {
        items.push(DiskSummary {
            disk_id: disk.disk_id,
            name: disk.name,
            size_gb: disk.size_gb,
            filesystem: disk.filesystem,
            performance_tier: disk.performance_tier,
            owner_display: disk.owner_display,
            owner_sub: disk.owner_sub,
            status: disk.status,
            iscsi_status: disk.iscsi_status,
            last_request_id: disk.last_request_id,
            created_at_ms: disk.created_at.timestamp_millis(),
            updated_at_ms: disk.updated_at.timestamp_millis(),
            iscsi: disk.iscsi,
        });
    }

    Ok(Json(items))
}

pub(crate) async fn io_monitoring(
    State(state): State<Arc<AppState>>,
) -> Result<Json<IoMonitoringResponse>, (axum::http::StatusCode, String)> {
    let snapshot = state.io_monitor.current_snapshot().await;

    let mut cursor = state
        .disks
        .find(doc! { "status": { "$ne": "deleted" } })
        .sort(doc! { "updated_at": -1_i32 })
        .await
        .map_err(internal_error)?;

    let mut disk_documents = Vec::new();
    while let Some(disk) = cursor.try_next().await.map_err(internal_error)? {
        disk_documents.push(disk);
    }

    Ok(Json(build_monitoring_response(snapshot, &disk_documents)))
}

pub(crate) async fn delete_disk(
    Query(query): Query<DeleteDiskQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let disk_id = query.disk_id.trim().to_owned();
    let request_id = query.request_id.trim().to_owned();

    if disk_id.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "disk_id is required".to_owned(),
        ));
    }

    if request_id.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "request_id is required".to_owned(),
        ));
    }

    let Some(existing) = state
        .disks
        .find_one(doc! { "_id": &disk_id })
        .await
        .map_err(internal_error)?
    else {
        return Err((
            axum::http::StatusCode::NOT_FOUND,
            "disk not found".to_owned(),
        ));
    };

    if existing.owner_sub.trim() != query.owner_sub.trim() {
        return Err((
            axum::http::StatusCode::FORBIDDEN,
            "disk belongs to another user".to_owned(),
        ));
    }

    if existing.status == "deleting" {
        return Ok(Json(json!({
            "request_id": existing.last_request_id,
            "disk_id": existing.disk_id,
            "status": "deleting"
        })));
    }

    if existing.status == "deleted" {
        return Err((
            axum::http::StatusCode::CONFLICT,
            "disk is already deleted".to_owned(),
        ));
    }

    state
        .disks
        .update_one(
            doc! { "_id": &disk_id },
            doc! {
                "$set": {
                    "status": "deleting",
                    "iscsi_status": "deleting",
                    "last_request_id": &request_id,
                    "updated_at": DateTime::now(),
                }
            },
        )
        .await
        .map_err(internal_error)?;

    let disk = DiskPayload {
        disk_id: existing.disk_id.clone(),
        name: existing.name.clone(),
        size_gb: existing.size_gb,
        filesystem: existing.filesystem.clone(),
        performance_tier: existing.performance_tier.clone(),
        owner_sub: existing.owner_sub.clone(),
        owner_display: existing.owner_display.clone(),
        status: "deleting".to_owned(),
        iscsi_status: "deleting".to_owned(),
    };

    let mut event = WorkflowEvent {
        request_id: request_id.clone(),
        operation: WorkflowOperation::Delete,
        identity: Some(UserIdentity {
            sub: existing.owner_sub.clone(),
            preferred_username: None,
            email: None,
            name: Some(existing.owner_display.clone()),
            realm_roles: Vec::new(),
            client_roles: Vec::new(),
        }),
        disk: Some(disk),
        outputs: Vec::new(),
    };

    let message = format!(
        "Disk service: удаление диска {} ({}) запрошено, запускаем cleanup downstream",
        existing.name, existing.disk_id
    );

    event.outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    publish_frontend_update(&state.producer, &event, &message, false)
        .await
        .map_err(internal_error)?;
    publish_event(
        &state.producer,
        crate::constants::OUTPUT_TOPIC,
        &request_id,
        &event,
    )
    .await
    .map_err(internal_error)?;

    info!(
        service = SERVICE_NAME,
        disk_id = %disk_id,
        owner_sub = %query.owner_sub,
        request_id = %request_id,
        "disk deletion requested"
    );

    Ok(Json(json!({
        "request_id": request_id,
        "disk_id": existing.disk_id,
        "status": "deleting"
    })))
}

pub(crate) async fn update_disk_owner(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateDiskOwnerRequest>,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let disk_id = payload.disk_id.trim().to_owned();
    let owner_sub = payload.owner_sub.trim().to_owned();
    let owner_display = payload.owner_display.trim().to_owned();

    if disk_id.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "disk_id is required".to_owned(),
        ));
    }

    if owner_sub.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "owner_sub is required".to_owned(),
        ));
    }

    if owner_display.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "owner_display is required".to_owned(),
        ));
    }

    let Some(existing) = state
        .disks
        .find_one(doc! { "_id": &disk_id })
        .await
        .map_err(internal_error)?
    else {
        return Err((
            axum::http::StatusCode::NOT_FOUND,
            "disk not found".to_owned(),
        ));
    };

    if existing.status == "deleted" {
        return Err((
            axum::http::StatusCode::CONFLICT,
            "disk is already deleted".to_owned(),
        ));
    }

    state
        .disks
        .update_one(
            doc! { "_id": &disk_id },
            doc! {
                "$set": {
                    "owner_sub": &owner_sub,
                    "owner_display": &owner_display,
                    "updated_at": DateTime::now(),
                }
            },
        )
        .await
        .map_err(internal_error)?;

    info!(
        service = SERVICE_NAME,
        disk_id = %disk_id,
        owner_sub = %owner_sub,
        owner_display = %owner_display,
        "disk owner updated"
    );

    Ok(Json(json!({
        "disk_id": disk_id,
        "owner_sub": owner_sub,
        "owner_display": owner_display,
        "status": "updated"
    })))
}

pub(crate) async fn root() -> Json<Value> {
    info!(service = SERVICE_NAME, path = "/", "healthcheck handled");
    Json(json!({ "200": "ok" }))
}
