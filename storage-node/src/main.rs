mod constants;
mod driver;
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
    infra::{create_producer, init_tracing, kafka_brokers},
    routes::root,
    workflow::spawn_workflow_consumer,
};

#[tokio::main]
async fn main() -> Result<(), AppError> {
    init_tracing("info");

    let brokers = kafka_brokers();
    let producer = create_producer(&brokers)?;

    spawn_workflow_consumer(brokers, producer);

    let app = Router::new()
        .route("/", get(root))
        .layer(TraceLayer::new_for_http());
    let listener = TcpListener::bind(("0.0.0.0", PORT))
        .await
        .expect("failed to bind storage-node service");

    info!(service = SERVICE_NAME, port = PORT, "service started");

    axum::serve(listener, app)
        .await
        .expect("failed to serve storage-node service");

    Ok(())
}
