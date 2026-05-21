use mongodb::{
    bson::{doc, DateTime},
    Collection,
};
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
    constants::{AppError, DISK_TOPIC, FRONTEND_TOPIC, INPUT_TOPIC, ISCSI_TOPIC, SERVICE_NAME},
    infra::create_consumer,
    models::{FrontendUpdate, PersonalProfile, StageOutput, WorkflowEvent, WorkflowOperation},
};

pub(crate) fn spawn_workflow_consumer(
    brokers: String,
    producer: FutureProducer,
    profiles: Collection<PersonalProfile>,
) {
    tokio::spawn(async move {
        loop {
            let consumer = match create_consumer(&brokers, "personal-service-group") {
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

            consume_workflow_events(consumer, producer.clone(), profiles.clone()).await;
        }
    });
}

async fn consume_workflow_events(
    consumer: StreamConsumer,
    producer: FutureProducer,
    profiles: Collection<PersonalProfile>,
) {
    loop {
        match consumer.recv().await {
            Ok(message) => {
                let Some(payload) = message.payload_view::<str>().and_then(Result::ok) else {
                    continue;
                };

                if let Err(err) =
                    handle_workflow_event(payload.to_owned(), producer.clone(), profiles.clone())
                        .await
                {
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

async fn handle_workflow_event(
    payload: String,
    producer: FutureProducer,
    profiles: Collection<PersonalProfile>,
) -> Result<(), AppError> {
    let mut event: WorkflowEvent = serde_json::from_str(&payload)?;

    if event.operation == WorkflowOperation::Delete {
        let disk = event
            .disk
            .as_ref()
            .ok_or_else(|| "delete workflow event does not contain disk payload".to_owned())?;
        let message = format!(
            "Personal service: подтверждена принадлежность профиля для удаления диска {}",
            disk.disk_id
        );

        info!(
            service = SERVICE_NAME,
            request_id = %event.request_id,
            disk_id = %disk.disk_id,
            "forwarding delete workflow event"
        );

        event.outputs.push(StageOutput {
            service: SERVICE_NAME.to_owned(),
            message: message.clone(),
        });

        publish_frontend_update(&producer, &event, &message, false).await?;
        publish_event(&producer, ISCSI_TOPIC, &event.request_id, &event).await?;
        return Ok(());
    }

    let stored_profile = upsert_profile(&profiles, &event).await?;
    let profile_name = stored_profile
        .name
        .clone()
        .or_else(|| stored_profile.preferred_username.clone())
        .or_else(|| stored_profile.email.clone())
        .unwrap_or_else(|| stored_profile.sub.clone());
    let message = if let Some(disk) = event.disk.as_ref() {
        format!(
            "Personal service: профиль {profile_name} синхронизирован с MongoDB и привязан к диску {}",
            disk.disk_id
        )
    } else {
        format!(
            "Personal service: профиль {profile_name} синхронизирован с MongoDB и связан с id service"
        )
    };

    info!(
        service = SERVICE_NAME,
        request_id = %event.request_id,
        subject = %stored_profile.sub,
        "processing workflow event"
    );

    event.outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    publish_frontend_update(&producer, &event, &message, false).await?;
    let next_topic = if event.disk.is_some() {
        ISCSI_TOPIC
    } else {
        DISK_TOPIC
    };
    publish_event(&producer, next_topic, &event.request_id, &event).await?;

    Ok(())
}

async fn upsert_profile(
    profiles: &Collection<PersonalProfile>,
    event: &WorkflowEvent,
) -> Result<PersonalProfile, AppError> {
    let identity = event
        .identity
        .as_ref()
        .ok_or_else(|| "workflow event does not contain identity payload".to_owned())?;

    profiles
        .update_one(
            doc! { "_id": &identity.sub },
            doc! {
                "$set": {
                    "preferred_username": &identity.preferred_username,
                    "email": &identity.email,
                    "name": &identity.name,
                    "realm_roles": &identity.realm_roles,
                    "client_roles": &identity.client_roles,
                    "source_service": SERVICE_NAME,
                    "last_request_id": &event.request_id,
                    "last_synced_at": DateTime::now(),
                },
                "$setOnInsert": {
                    "created_at": DateTime::now(),
                }
            },
        )
        .upsert(true)
        .await?;

    let profile = profiles
        .find_one(doc! { "_id": &identity.sub })
        .await?
        .ok_or_else(|| "profile not found after MongoDB upsert".to_owned())?;

    Ok(profile)
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
