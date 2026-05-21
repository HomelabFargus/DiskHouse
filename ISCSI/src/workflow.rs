use mongodb::{
    bson::{doc, DateTime, Document},
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
    constants::{
        AppError, FRONTEND_TOPIC, INPUT_TOPIC, SERVICE_NAME, STORAGE_NODE_REQUEST_TOPIC,
        STORAGE_NODE_RESPONSE_TOPIC,
    },
    infra::{create_consumer, iscsi_portal_address, iscsi_portal_port},
    models::{
        DiskPayload, ExportCollection, FrontendUpdate, IscsiConnectionInfo, IscsiExportDocument,
        StageOutput, StorageNodeCommand, StorageNodeResponse, WorkflowEvent, WorkflowOperation,
    },
};

pub(crate) fn spawn_workflow_consumer(
    brokers: String,
    producer: FutureProducer,
    exports: ExportCollection,
    disks: Collection<Document>,
) {
    tokio::spawn(async move {
        loop {
            let consumer = match create_consumer(&brokers, "iscsi-service-group") {
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

            consume_workflow_events(consumer, producer.clone(), exports.clone(), disks.clone()).await;
        }
    });
}

pub(crate) fn spawn_storage_response_consumer(
    brokers: String,
    producer: FutureProducer,
    exports: ExportCollection,
    disks: Collection<Document>,
) {
    tokio::spawn(async move {
        loop {
            let consumer =
                match create_consumer(&brokers, "iscsi-storage-node-response-group") {
                    Ok(consumer) => consumer,
                    Err(err) => {
                        error!(service = SERVICE_NAME, error = %err, "failed to create storage-node response consumer");
                        sleep(Duration::from_secs(2)).await;
                        continue;
                    }
                };

            if let Err(err) = consumer.subscribe(&[STORAGE_NODE_RESPONSE_TOPIC]) {
                error!(service = SERVICE_NAME, error = %err, "failed to subscribe to storage-node response topic");
                sleep(Duration::from_secs(2)).await;
                continue;
            }

            info!(
                service = SERVICE_NAME,
                topic = STORAGE_NODE_RESPONSE_TOPIC,
                "storage-node response consumer subscribed"
            );

            consume_storage_responses(consumer, producer.clone(), exports.clone(), disks.clone()).await;
        }
    });
}

async fn consume_workflow_events(
    consumer: StreamConsumer,
    producer: FutureProducer,
    exports: ExportCollection,
    disks: Collection<Document>,
) {
    loop {
        match consumer.recv().await {
            Ok(message) => {
                let Some(payload) = message.payload_view::<str>().and_then(Result::ok) else {
                    continue;
                };

                if let Err(err) = handle_workflow_event(
                    payload.to_owned(),
                    producer.clone(),
                    exports.clone(),
                    disks.clone(),
                )
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

async fn consume_storage_responses(
    consumer: StreamConsumer,
    producer: FutureProducer,
    exports: ExportCollection,
    disks: Collection<Document>,
) {
    loop {
        match consumer.recv().await {
            Ok(message) => {
                let Some(payload) = message.payload_view::<str>().and_then(Result::ok) else {
                    continue;
                };

                if let Err(err) = handle_storage_node_response(
                    payload.to_owned(),
                    producer.clone(),
                    exports.clone(),
                    disks.clone(),
                )
                .await
                {
                    error!(service = SERVICE_NAME, error = %err, "failed to process storage-node response");
                }
            }
            Err(err) => {
                error!(service = SERVICE_NAME, error = %err, "kafka receive error on storage-node response topic");
                sleep(Duration::from_secs(2)).await;
                break;
            }
        }
    }
}

async fn handle_workflow_event(
    payload: String,
    producer: FutureProducer,
    exports: ExportCollection,
    disks: Collection<Document>,
) -> Result<(), AppError> {
    let mut event: WorkflowEvent = serde_json::from_str(&payload)?;

    let Some(disk) = event.disk.as_ref() else {
        let message = "ISCSI service: событие получено без disk payload".to_owned();
        event.outputs.push(StageOutput {
            service: SERVICE_NAME.to_owned(),
            message: message.clone(),
        });
        publish_frontend_update(&producer, &event, &message, true).await?;
        return Ok(());
    };

    let connection = build_connection_info(disk);
    prepare_operation_state(&event, disk, &connection, &exports, &disks).await?;

    let message = if event.operation == WorkflowOperation::Delete {
        format!(
            "ISCSI service: cleanup target {} для {} передан в storage-node",
            connection.target_iqn, disk.disk_id
        )
    } else {
        format!(
            "ISCSI service: публикация target {} для {} передана в storage-node",
            connection.target_iqn, disk.disk_id
        )
    };

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
    publish_event(
        &producer,
        STORAGE_NODE_REQUEST_TOPIC,
        &event.request_id,
        &StorageNodeCommand {
            request_id: event.request_id.clone(),
            operation: event.operation.clone(),
            disk: disk.clone(),
            connection,
            outputs: event.outputs.clone(),
        },
    )
    .await?;

    Ok(())
}

async fn handle_storage_node_response(
    payload: String,
    producer: FutureProducer,
    exports: ExportCollection,
    disks: Collection<Document>,
) -> Result<(), AppError> {
    let response: StorageNodeResponse = serde_json::from_str(&payload)?;

    let message = match (response.operation.clone(), response.success) {
        (WorkflowOperation::Create, true) => {
            finalize_create_success(&response, &exports, &disks).await?
        }
        (WorkflowOperation::Create, false) => {
            finalize_create_failure(&response, &exports, &disks).await?
        }
        (WorkflowOperation::Delete, true) => {
            finalize_delete_success(&response, &exports, &disks).await?
        }
        (WorkflowOperation::Delete, false) => {
            finalize_delete_failure(&response, &exports, &disks).await?
        }
    };

    let mut event = WorkflowEvent {
        request_id: response.request_id.clone(),
        operation: response.operation,
        identity: None,
        disk: Some(response.disk),
        outputs: response.outputs,
    };

    event.outputs.push(StageOutput {
        service: SERVICE_NAME.to_owned(),
        message: message.clone(),
    });

    publish_frontend_update(&producer, &event, &message, true).await
}

async fn prepare_operation_state(
    event: &WorkflowEvent,
    disk: &DiskPayload,
    connection: &IscsiConnectionInfo,
    exports: &ExportCollection,
    disks: &Collection<Document>,
) -> Result<(), AppError> {
    let export_status = if event.operation == WorkflowOperation::Delete {
        "deleting"
    } else {
        "publishing"
    };

    let disk_status = if event.operation == WorkflowOperation::Delete {
        "deleting"
    } else {
        "provisioning"
    };
    let iscsi_status = if event.operation == WorkflowOperation::Delete {
        "deleting"
    } else {
        "publishing"
    };

    exports
        .update_one(
            doc! { "_id": &connection.export_id },
            doc! {
                "$set": {
                    "disk_id": &disk.disk_id,
                    "request_id": &event.request_id,
                    "owner_sub": &disk.owner_sub,
                    "owner_display": &disk.owner_display,
                    "target_iqn": &connection.target_iqn,
                    "portal_address": &connection.portal_address,
                    "portal_port": connection.portal_port,
                    "lun": connection.lun,
                    "auth_type": &connection.auth_type,
                    "discovery_command": &connection.discovery_command,
                    "login_command": &connection.login_command,
                    "device_path": &connection.device_path,
                    "mount_hint": &connection.mount_hint,
                    "status": export_status,
                    "source_service": SERVICE_NAME,
                    "updated_at": DateTime::now(),
                },
                "$setOnInsert": {
                    "created_at": DateTime::now(),
                }
            },
        )
        .upsert(true)
        .await?;

    disks
        .update_one(
            doc! { "_id": &disk.disk_id },
            doc! {
                "$set": {
                    "status": disk_status,
                    "iscsi_status": iscsi_status,
                    "iscsi": {
                        "export_id": &connection.export_id,
                        "target_iqn": &connection.target_iqn,
                        "portal_address": &connection.portal_address,
                        "portal_port": connection.portal_port,
                        "lun": connection.lun,
                        "auth_type": &connection.auth_type,
                        "discovery_command": &connection.discovery_command,
                        "login_command": &connection.login_command,
                        "device_path": &connection.device_path,
                        "mount_hint": &connection.mount_hint,
                        "status": export_status,
                    },
                    "updated_at": DateTime::now(),
                    "last_request_id": &event.request_id,
                }
            },
        )
        .await?;

    Ok(())
}

async fn finalize_create_success(
    response: &StorageNodeResponse,
    exports: &ExportCollection,
    disks: &Collection<Document>,
) -> Result<String, AppError> {
    exports
        .update_one(
            doc! { "_id": &response.connection.export_id },
            doc! {
                "$set": {
                    "status": "ready",
                    "updated_at": DateTime::now(),
                    "request_id": &response.request_id,
                }
            },
        )
        .await?;

    disks
        .update_one(
            doc! { "_id": &response.disk.disk_id },
            doc! {
                "$set": {
                    "status": "ready",
                    "iscsi_status": "ready",
                    "iscsi.status": "ready",
                    "updated_at": DateTime::now(),
                    "last_request_id": &response.request_id,
                }
            },
        )
        .await?;

    Ok(format!(
        "ISCSI service: target {} для {} опубликован и помечен ready",
        response.connection.target_iqn, response.disk.disk_id
    ))
}

async fn finalize_create_failure(
    response: &StorageNodeResponse,
    exports: &ExportCollection,
    disks: &Collection<Document>,
) -> Result<String, AppError> {
    exports
        .update_one(
            doc! { "_id": &response.connection.export_id },
            doc! {
                "$set": {
                    "status": "failed",
                    "updated_at": DateTime::now(),
                    "request_id": &response.request_id,
                }
            },
        )
        .await?;

    disks
        .update_one(
            doc! { "_id": &response.disk.disk_id },
            doc! {
                "$set": {
                    "status": "failed",
                    "iscsi_status": "failed",
                    "iscsi.status": "failed",
                    "updated_at": DateTime::now(),
                    "last_request_id": &response.request_id,
                }
            },
        )
        .await?;

    Ok(format!(
        "ISCSI service: публикация target {} для {} завершилась ошибкой: {}",
        response.connection.target_iqn, response.disk.disk_id, response.message
    ))
}

async fn finalize_delete_success(
    response: &StorageNodeResponse,
    exports: &ExportCollection,
    disks: &Collection<Document>,
) -> Result<String, AppError> {
    exports
        .delete_one(doc! { "_id": &response.connection.export_id })
        .await?;

    disks
        .update_one(
            doc! { "_id": &response.disk.disk_id },
            doc! {
                "$set": {
                    "status": "deleted",
                    "iscsi_status": "deleted",
                    "updated_at": DateTime::now(),
                    "last_request_id": &response.request_id,
                },
                "$unset": {
                    "iscsi": "",
                },
            },
        )
        .await?;

    Ok(format!(
        "ISCSI service: export для {} удалён после успешного cleanup на storage-node",
        response.disk.disk_id
    ))
}

async fn finalize_delete_failure(
    response: &StorageNodeResponse,
    exports: &ExportCollection,
    disks: &Collection<Document>,
) -> Result<String, AppError> {
    exports
        .update_one(
            doc! { "_id": &response.connection.export_id },
            doc! {
                "$set": {
                    "status": "ready",
                    "updated_at": DateTime::now(),
                    "request_id": &response.request_id,
                }
            },
        )
        .await?;

    disks
        .update_one(
            doc! { "_id": &response.disk.disk_id },
            doc! {
                "$set": {
                    "status": "ready",
                    "iscsi_status": "ready",
                    "iscsi.status": "ready",
                    "updated_at": DateTime::now(),
                    "last_request_id": &response.request_id,
                }
            },
        )
        .await?;

    Ok(format!(
        "ISCSI service: cleanup target {} для {} завершился ошибкой, диск возвращён в ready: {}",
        response.connection.target_iqn, response.disk.disk_id, response.message
    ))
}

fn build_connection_info(disk: &DiskPayload) -> IscsiConnectionInfo {
    let portal_address = iscsi_portal_address();
    let portal_port = iscsi_portal_port();
    let target_iqn = format!("iqn.2026-04.diskhouse:{}:{}", disk.owner_sub, disk.disk_id);
    let device_path = format!(
        "/dev/disk/by-path/ip-{portal_address}:{portal_port}-iscsi-{target_iqn}-lun-0"
    );
    let discovery_command =
        format!("sudo iscsiadm -m discovery -t sendtargets -p {portal_address}:{portal_port}");
    let login_command = format!(
        "sudo iscsiadm -m node -T {target_iqn} -p {portal_address}:{portal_port} --login"
    );
    let mount_hint = format!(
        "sudo mkdir -p /mnt/{disk_id} && sudo mount {device_path} /mnt/{disk_id}",
        disk_id = disk.disk_id
    );

    IscsiConnectionInfo {
        export_id: format!("export-{}", disk.disk_id),
        target_iqn,
        portal_address,
        portal_port,
        lun: 0,
        auth_type: "none".to_owned(),
        discovery_command,
        login_command,
        device_path,
        mount_hint,
        status: "ready".to_owned(),
    }
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
