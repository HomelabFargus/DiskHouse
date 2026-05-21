use mongodb::{options::ClientOptions, Client, Collection};
use rdkafka::{
    config::ClientConfig,
    consumer::StreamConsumer,
    producer::FutureProducer,
};
use std::{env, path::PathBuf};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    constants::{
        AppError, DEFAULT_BROKERS, DEFAULT_MONGO_DATABASE, DEFAULT_MONGO_URI,
        DEFAULT_STORAGE_NODE_BACKING_STORE_DIR, DISK_COLLECTION,
    },
    models::{DiskDocument, UserIdentity},
};

pub(crate) fn init_tracing(default_level: &str) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(format!("{default_level},tower_http={default_level}")));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_target(true))
        .init();
}

pub(crate) fn kafka_brokers() -> String {
    env::var("KAFKA_BROKERS").unwrap_or_else(|_| DEFAULT_BROKERS.to_owned())
}

pub(crate) fn storage_node_backing_store_dir() -> PathBuf {
    PathBuf::from(
        env::var("STORAGE_NODE_BACKING_STORE_DIR")
            .unwrap_or_else(|_| DEFAULT_STORAGE_NODE_BACKING_STORE_DIR.to_owned()),
    )
}

fn mongo_uri() -> String {
    env::var("MONGO_URI").unwrap_or_else(|_| DEFAULT_MONGO_URI.to_owned())
}

fn mongo_database() -> String {
    env::var("MONGO_DATABASE").unwrap_or_else(|_| DEFAULT_MONGO_DATABASE.to_owned())
}

pub(crate) fn create_producer(brokers: &str) -> Result<FutureProducer, AppError> {
    Ok(ClientConfig::new()
        .set("bootstrap.servers", brokers)
        .set("message.timeout.ms", "5000")
        .create()?)
}

pub(crate) fn create_consumer(
    brokers: &str,
    group_id: &str,
) -> Result<StreamConsumer, AppError> {
    Ok(ClientConfig::new()
        .set("group.id", group_id)
        .set("bootstrap.servers", brokers)
        .set("enable.auto.commit", "true")
        .set("auto.offset.reset", "earliest")
        .create()?)
}

pub(crate) async fn create_disk_collection() -> Result<Collection<DiskDocument>, AppError> {
    let options = ClientOptions::parse(mongo_uri()).await?;
    let client = Client::with_options(options)?;
    let database = client.database(&mongo_database());

    Ok(database.collection::<DiskDocument>(DISK_COLLECTION))
}

pub(crate) fn display_name(identity: &UserIdentity) -> String {
    identity
        .name
        .clone()
        .or_else(|| identity.preferred_username.clone())
        .or_else(|| identity.email.clone())
        .unwrap_or_else(|| identity.sub.clone())
}

pub(crate) fn internal_error(
    error: impl ToString,
) -> (axum::http::StatusCode, String) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        error.to_string(),
    )
}
