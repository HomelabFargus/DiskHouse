use std::error::Error;

pub(crate) const SERVICE_NAME: &str = "id";
pub(crate) const PORT: u16 = 3001;
pub(crate) const INPUT_TOPIC: &str = "eda.id.requests";
pub(crate) const OUTPUT_TOPIC: &str = "eda.personal.requests";
pub(crate) const FRONTEND_TOPIC: &str = "eda.frontend.updates";
pub(crate) const DEFAULT_BROKERS: &str =
    "kafka-worker-1:9092,kafka-worker-2:9092,kafka-worker-3:9092";
pub(crate) const DEFAULT_KEYCLOAK_BASE_URL: &str = "http://keycloak:8080";
pub(crate) const DEFAULT_KEYCLOAK_REALM: &str = "diskhub";
pub(crate) const DEFAULT_KEYCLOAK_CLIENT_ID: &str = "diskhub_main";
pub(crate) const DEFAULT_KEYCLOAK_ADMIN_REALM: &str = "master";
pub(crate) const DEFAULT_KEYCLOAK_ADMIN_CLIENT_ID: &str = "admin-cli";
pub(crate) const DEFAULT_KEYCLOAK_ADMIN_USERNAME: &str = "admin";
pub(crate) const DEFAULT_KEYCLOAK_ADMIN_PASSWORD: &str = "admin";

pub(crate) type AppError = Box<dyn Error + Send + Sync>;
