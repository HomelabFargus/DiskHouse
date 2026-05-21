use std::error::Error;

pub(crate) const SERVICE_NAME: &str = "iscsi";
pub(crate) const PORT: u16 = 3004;
pub(crate) const INPUT_TOPIC: &str = "eda.iscsi.requests";
pub(crate) const FRONTEND_TOPIC: &str = "eda.frontend.updates";
pub(crate) const STORAGE_NODE_REQUEST_TOPIC: &str = "eda.storage-node.requests";
pub(crate) const STORAGE_NODE_RESPONSE_TOPIC: &str = "eda.storage-node.responses";
pub(crate) const DEFAULT_BROKERS: &str =
    "kafka-worker-1:9092,kafka-worker-2:9092,kafka-worker-3:9092";
pub(crate) const DEFAULT_MONGO_URI: &str = "mongodb://admin:admin@mongo:27017/?authSource=admin";
pub(crate) const DEFAULT_MONGO_DATABASE: &str = "diskhouse";
pub(crate) const ISCSI_COLLECTION: &str = "iscsi_exports";
pub(crate) const DISK_COLLECTION: &str = "disks";
pub(crate) const DEFAULT_ISCSI_PORTAL_ADDRESS: &str = "127.0.0.1";
pub(crate) const DEFAULT_ISCSI_PORTAL_PORT: i32 = 3260;

pub(crate) type AppError = Box<dyn Error + Send + Sync>;
