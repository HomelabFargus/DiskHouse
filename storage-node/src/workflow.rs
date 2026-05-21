use rdkafka::{
    consumer::{Consumer, StreamConsumer},
    message::Message,
    producer::{FutureProducer, FutureRecord},
    util::Timeout,
};
use serde::Serialize;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, info};

use crate::{
    constants::{AppError, INPUT_TOPIC, OUTPUT_TOPIC, SERVICE_NAME},
    driver::{create_target, delete_target},
    infra::create_consumer,
    models::{StageOutput, StorageNodeCommand, StorageNodeResponse, WorkflowOperation},
};

pub(crate) fn spawn_workflow_consumer(brokers: String, producer: FutureProducer) {
    tokio::spawn(async move {
        loop {
            let consumer = match create_consumer(&brokers, "storage-node-service-group") {
                Ok(consumer) => consumer,
                Err(err) => {
                    error!(service = SERVICE_NAME, error = %err, "failed to create kafka consumer");
                    sleep(Duration::from_secs(2)).await;
                    continue;
                }
            };

            if let Err(err) = consumer.subscribe(&[INPUT_TOPIC]) {
                error!(service = SERVICE_NAME, error = %err, "failed to subscribe to kafka topic");
                sleep(Duration::from_secs(2)).await;
                continue;
            }

            info!(service = SERVICE_NAME, topic = INPUT_TOPIC, "kafka consumer subscribed");

            consume_commands(consumer, producer.clone()).await;
        }
    });
}

async fn consume_commands(consumer: StreamConsumer, producer: FutureProducer) {
    loop {
        match consumer.recv().await {
            Ok(message) => {
                let Some(payload) = message.payload_view::<str>().and_then(Result::ok) else {
                    continue;
                };

                if let Err(err) = handle_command(payload.to_owned(), producer.clone()).await {
                    error!(service = SERVICE_NAME, error = %err, "failed to process storage-node command");
                }
            }
            Err(err) => {
                error!(service = SERVICE_NAME, error = %err, "kafka receive error");
                sleep(Duration::from_secs(2)).await;
                break;
            }
        }
    }
}

async fn handle_command(payload: String, producer: FutureProducer) -> Result<(), AppError> {
    let command: StorageNodeCommand = serde_json::from_str(&payload)?;
    let outcome = if command.operation == WorkflowOperation::Delete {
        delete_target(&command).await
    } else {
        create_target(&command).await
    };

    let (success, message) = match outcome {
        Ok(message) => (true, message),
        Err(err) => (false, err),
    };

    let mut outputs = command.outputs.clone();
    outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    let response = StorageNodeResponse {
        request_id: command.request_id.clone(),
        operation: command.operation,
        disk: command.disk,
        connection: command.connection,
        success,
        message,
        outputs,
    };

    publish_event(&producer, OUTPUT_TOPIC, &response.request_id, &response).await
}

pub(crate) async fn publish_event<T: Serialize>(
    producer: &FutureProducer,
    topic: &str,
    key: &str,
    payload: &T,
) -> Result<(), AppError> {
    let body = serde_json::to_string(payload)?;

    producer
        .send(
            FutureRecord::to(topic).payload(&body).key(key),
            Timeout::Never,
        )
        .await
        .map_err(|(err, _)| -> AppError { Box::new(err) })?;

    Ok(())
}
