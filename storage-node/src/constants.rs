use std::error::Error;

pub(crate) const SERVICE_NAME: &str = "storage-node";
pub(crate) const PORT: u16 = 3005;
pub(crate) const INPUT_TOPIC: &str = "eda.storage-node.requests";
pub(crate) const OUTPUT_TOPIC: &str = "eda.storage-node.responses";
pub(crate) const DEFAULT_BROKERS: &str =
    "kafka-worker-1:9092,kafka-worker-2:9092,kafka-worker-3:9092";
pub(crate) const DEFAULT_STORAGE_NODE_DRIVER: &str = "mock";
pub(crate) const DEFAULT_BACKING_STORE_DIR: &str = "/var/lib/diskhouse/iscsi";

pub(crate) type AppError = Box<dyn Error + Send + Sync>;
