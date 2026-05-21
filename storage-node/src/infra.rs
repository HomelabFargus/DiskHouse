use rdkafka::{
    config::ClientConfig,
    consumer::StreamConsumer,
    producer::FutureProducer,
};
use std::{env, path::PathBuf};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    constants::{
        AppError, DEFAULT_BACKING_STORE_DIR, DEFAULT_BROKERS, DEFAULT_STORAGE_NODE_DRIVER,
    },
    models::DriverMode,
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

pub(crate) fn storage_node_driver() -> DriverMode {
    match env::var("STORAGE_NODE_DRIVER")
        .unwrap_or_else(|_| DEFAULT_STORAGE_NODE_DRIVER.to_owned())
        .to_lowercase()
        .as_str()
    {
        "targetcli" => DriverMode::TargetCli,
        "mock" => DriverMode::Mock,
        _ => DriverMode::Auto,
    }
}

pub(crate) fn backing_store_dir() -> PathBuf {
    PathBuf::from(
        env::var("STORAGE_NODE_BACKING_STORE_DIR")
            .unwrap_or_else(|_| DEFAULT_BACKING_STORE_DIR.to_owned()),
    )
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
