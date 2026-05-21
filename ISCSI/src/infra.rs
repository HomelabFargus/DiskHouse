use mongodb::{
    bson::Document,
    options::ClientOptions,
    Client, Collection,
};
use rdkafka::{
    config::ClientConfig,
    consumer::StreamConsumer,
    producer::FutureProducer,
};
use std::env;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    constants::{
        AppError, DEFAULT_BROKERS, DEFAULT_ISCSI_PORTAL_ADDRESS, DEFAULT_ISCSI_PORTAL_PORT,
        DEFAULT_MONGO_DATABASE, DEFAULT_MONGO_URI, DISK_COLLECTION, ISCSI_COLLECTION,
    },
    models::IscsiExportDocument,
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

fn mongo_uri() -> String {
    env::var("MONGO_URI").unwrap_or_else(|_| DEFAULT_MONGO_URI.to_owned())
}

fn mongo_database() -> String {
    env::var("MONGO_DATABASE").unwrap_or_else(|_| DEFAULT_MONGO_DATABASE.to_owned())
}

pub(crate) fn iscsi_portal_address() -> String {
    env::var("ISCSI_PORTAL_ADDRESS").unwrap_or_else(|_| DEFAULT_ISCSI_PORTAL_ADDRESS.to_owned())
}

pub(crate) fn iscsi_portal_port() -> i32 {
    env::var("ISCSI_PORTAL_PORT")
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_ISCSI_PORTAL_PORT)
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

pub(crate) async fn create_export_collection() -> Result<Collection<IscsiExportDocument>, AppError> {
    let options = ClientOptions::parse(mongo_uri()).await?;
    let client = Client::with_options(options)?;
    let database = client.database(&mongo_database());

    Ok(database.collection::<IscsiExportDocument>(ISCSI_COLLECTION))
}

pub(crate) async fn create_disk_collection() -> Result<Collection<Document>, AppError> {
    let options = ClientOptions::parse(mongo_uri()).await?;
    let client = Client::with_options(options)?;
    let database = client.database(&mongo_database());

    Ok(database.collection::<Document>(DISK_COLLECTION))
}
