use std::error::Error;

pub(crate) const SERVICE_NAME: &str = "personal";
pub(crate) const PORT: u16 = 3002;
pub(crate) const INPUT_TOPIC: &str = "eda.personal.requests";
pub(crate) const DISK_TOPIC: &str = "eda.disk.requests";
pub(crate) const ISCSI_TOPIC: &str = "eda.iscsi.requests";
pub(crate) const FRONTEND_TOPIC: &str = "eda.frontend.updates";
pub(crate) const DEFAULT_BROKERS: &str =
    "kafka-worker-1:9092,kafka-worker-2:9092,kafka-worker-3:9092";
pub(crate) const DEFAULT_MONGO_URI: &str = "mongodb://admin:admin@mongo:27017/?authSource=admin";
pub(crate) const DEFAULT_MONGO_DATABASE: &str = "diskhouse";
pub(crate) const PROFILE_COLLECTION: &str = "personal_profiles";

pub(crate) type AppError = Box<dyn Error + Send + Sync>;
