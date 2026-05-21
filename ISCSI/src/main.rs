mod constants;
mod infra;
mod models;
mod routes;
mod workflow;

use axum::{routing::get, Router};
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::{
    constants::{AppError, PORT, SERVICE_NAME},
    infra::{create_disk_collection, create_export_collection, create_producer, init_tracing, kafka_brokers},
    routes::root,
    workflow::{spawn_storage_response_consumer, spawn_workflow_consumer},
};

#[tokio::main]
async fn main() -> Result<(), AppError> {
    init_tracing("info");

    let brokers = kafka_brokers();
    let producer = create_producer(&brokers)?;
    let exports = create_export_collection().await?;
    let disks = create_disk_collection().await?;

    spawn_workflow_consumer(
        brokers.clone(),
        producer.clone(),
        exports.clone(),
        disks.clone(),
    );
    spawn_storage_response_consumer(brokers, producer, exports, disks);

    let app = Router::new()
        .route("/", get(root))
        .layer(TraceLayer::new_for_http());
    let listener = TcpListener::bind(("0.0.0.0", PORT))
        .await
        .expect("failed to bind iscsi service");

    info!(service = SERVICE_NAME, port = PORT, "service started");

    axum::serve(listener, app)
        .await
        .expect("failed to serve iscsi service");

    Ok(())
}
