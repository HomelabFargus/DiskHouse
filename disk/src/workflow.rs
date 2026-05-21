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
    constants::{AppError, FRONTEND_TOPIC, INPUT_TOPIC, MONITORING_TOPIC, OUTPUT_TOPIC, SERVICE_NAME},
    infra::create_consumer,
    models::{DiskDocument, FrontendUpdate, StageOutput, WorkflowEvent, WorkflowOperation},
    monitoring::{build_monitoring_response, IoMonitor},
};
use futures::TryStreamExt;
use mongodb::{bson::doc, Collection};
use std::sync::Arc;

pub(crate) fn spawn_workflow_consumer(brokers: String, producer: FutureProducer) {
    tokio::spawn(async move {
        loop {
            let consumer = match create_consumer(&brokers, "disk-service-group") {
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

            consume_workflow_events(consumer, producer.clone()).await;
        }
    });
}

pub(crate) fn spawn_monitoring_publisher(
    producer: FutureProducer,
    io_monitor: Arc<IoMonitor>,
    disks: Collection<DiskDocument>,
) {
    tokio::spawn(async move {
        loop {
            if let Err(err) =
                publish_monitoring_snapshot(&producer, io_monitor.as_ref(), &disks).await
            {
                error!(service = SERVICE_NAME, error = %err, "failed to publish io monitoring snapshot");
            }

            sleep(Duration::from_secs(5)).await;
        }
    });
}

async fn consume_workflow_events(consumer: StreamConsumer, producer: FutureProducer) {
    loop {
        match consumer.recv().await {
            Ok(message) => {
                let Some(payload) = message.payload_view::<str>().and_then(Result::ok) else {
                    continue;
                };

                if let Err(err) = handle_workflow_event(payload.to_owned(), producer.clone()).await {
                    error!(service = SERVICE_NAME, error = %err, "failed to process workflow event");
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

async fn handle_workflow_event(payload: String, producer: FutureProducer) -> Result<(), AppError> {
    let mut event: WorkflowEvent = serde_json::from_str(&payload)?;
    if event.operation == WorkflowOperation::Delete {
        return Ok(());
    }

    let message = "Disk service: найден доступный том и подготовлен storage-ресурс".to_owned();

    info!(
        service = SERVICE_NAME,
        request_id = %event.request_id,
        "processing workflow event"
    );

    event.outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    publish_frontend_update(&producer, &event, &message, false).await?;
    publish_event(&producer, OUTPUT_TOPIC, &event.request_id, &event).await?;

    Ok(())
}

async fn publish_monitoring_snapshot(
    producer: &FutureProducer,
    io_monitor: &IoMonitor,
    disks: &Collection<DiskDocument>,
) -> Result<(), AppError> {
    let snapshot = io_monitor.current_snapshot().await;
    let mut cursor = disks
        .find(doc! { "status": { "$ne": "deleted" } })
        .sort(doc! { "updated_at": -1_i32 })
        .await?;
    let mut disk_documents = Vec::new();

    while let Some(disk) = cursor.try_next().await? {
        disk_documents.push(disk);
    }

    let payload = build_monitoring_response(snapshot, &disk_documents);
    publish_event(producer, MONITORING_TOPIC, "system", &payload).await
}

pub(crate) async fn publish_frontend_update(
    producer: &FutureProducer,
    event: &WorkflowEvent,
    message: &str,
    complete: bool,
) -> Result<(), AppError> {
    let update = FrontendUpdate {
        request_id: event.request_id.clone(),
        service: SERVICE_NAME.to_owned(),
        message: message.to_owned(),
        outputs: event.outputs.clone(),
        complete,
    };

    publish_event(producer, FRONTEND_TOPIC, &event.request_id, &update).await
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
