mod constants;
mod infra;
mod monitoring;
mod models;
mod routes;
mod workflow;

use axum::{routing::get, Router};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::{
    constants::{AppError, PORT, SERVICE_NAME},
    infra::{
        create_disk_collection, create_producer, init_tracing, kafka_brokers,
        storage_node_backing_store_dir,
    },
    monitoring::IoMonitor,
    models::AppState,
    routes::{create_disk, delete_disk, io_monitoring, list_disks, root, update_disk_owner},
    workflow::{spawn_monitoring_publisher, spawn_workflow_consumer},
};

#[tokio::main]
async fn main() -> Result<(), AppError> {
    init_tracing("info");

    let brokers = kafka_brokers();
    let producer = create_producer(&brokers)?;
    let disks = create_disk_collection().await?;
    let io_monitor = IoMonitor::new(storage_node_backing_store_dir());
    io_monitor.clone().spawn();

    spawn_workflow_consumer(brokers, producer.clone());
    spawn_monitoring_publisher(producer.clone(), io_monitor.clone(), disks.clone());

    let app = Router::new()
        .route("/", get(root))
        .route("/monitoring/io", get(io_monitoring))
        .route(
            "/disks",
            get(list_disks)
                .post(create_disk)
                .put(update_disk_owner)
                .delete(delete_disk),
        )
        .with_state(Arc::new(AppState {
            producer,
            disks,
            io_monitor,
        }))
        .layer(TraceLayer::new_for_http());
    let listener = TcpListener::bind(("0.0.0.0", PORT))
        .await
        .expect("failed to bind disk service");

    info!(service = SERVICE_NAME, port = PORT, "service started");

    axum::serve(listener, app)
        .await
        .expect("failed to serve disk service");

    Ok(())
}
