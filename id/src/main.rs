mod constants;
mod models;
mod service;

use crate::{constants::AppError, service::run};

#[tokio::main]
async fn main() -> Result<(), AppError> {
    run().await
}
