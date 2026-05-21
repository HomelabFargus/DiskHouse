use std::error::Error;

pub(crate) const SERVICE_NAME: &str = "disk";
pub(crate) const PORT: u16 = 3003;
pub(crate) const INPUT_TOPIC: &str = "eda.disk.requests";
pub(crate) const PERSONAL_TOPIC: &str = "eda.personal.requests";
pub(crate) const OUTPUT_TOPIC: &str = "eda.iscsi.requests";
pub(crate) const FRONTEND_TOPIC: &str = "eda.frontend.updates";
pub(crate) const MONITORING_TOPIC: &str = "eda.monitoring.io";
pub(crate) const DEFAULT_BROKERS: &str =
    "kafka-worker-1:9092,kafka-worker-2:9092,kafka-worker-3:9092";
pub(crate) const DEFAULT_MONGO_URI: &str = "mongodb://admin:admin@mongo:27017/?authSource=admin";
pub(crate) const DEFAULT_MONGO_DATABASE: &str = "diskhouse";
pub(crate) const DISK_COLLECTION: &str = "disks";
pub(crate) const DEFAULT_STORAGE_NODE_BACKING_STORE_DIR: &str = "/var/lib/diskhouse/iscsi";

pub(crate) type AppError = Box<dyn Error + Send + Sync>;
