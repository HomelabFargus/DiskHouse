use axum::Json;
use serde_json::{json, Value};
use tracing::info;

use crate::constants::SERVICE_NAME;

pub(crate) async fn root() -> Json<Value> {
    info!(service = SERVICE_NAME, path = "/", "healthcheck handled");
    Json(json!({ "200": "ok" }))
}
