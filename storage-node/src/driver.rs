use std::{io::ErrorKind, path::PathBuf};

use tokio::{fs, process::Command};

use crate::{
    infra::{backing_store_dir, storage_node_driver},
    models::{DiskPayload, DriverError, DriverMode, IscsiConnectionInfo, StorageNodeCommand},
};

pub(crate) async fn create_target(command: &StorageNodeCommand) -> Result<String, String> {
    let disk = &command.disk;
    let connection = &command.connection;

    match storage_node_driver() {
        DriverMode::Mock => mock_create_target(disk).await,
        DriverMode::TargetCli => targetcli_create_target(disk, connection)
            .await
            .map_err(driver_error_message),
        DriverMode::Auto => match targetcli_create_target(disk, connection).await {
            Ok(message) => Ok(message),
            Err(err) => {
                if matches!(err, DriverError::BinaryMissing(_)) {
                    mock_create_target(disk).await
                } else {
                    Err(driver_error_message(err))
                }
            }
        },
    }
}

pub(crate) async fn delete_target(command: &StorageNodeCommand) -> Result<String, String> {
    let disk = &command.disk;
    let connection = &command.connection;

    match storage_node_driver() {
        DriverMode::Mock => mock_delete_target(disk).await,
        DriverMode::TargetCli => targetcli_delete_target(disk, connection)
            .await
            .map_err(driver_error_message),
        DriverMode::Auto => match targetcli_delete_target(disk, connection).await {
            Ok(message) => Ok(message),
            Err(err) => {
                if matches!(err, DriverError::BinaryMissing(_)) {
                    mock_delete_target(disk).await
                } else {
                    Err(driver_error_message(err))
                }
            }
        },
    }
}

async fn mock_create_target(disk: &DiskPayload) -> Result<String, String> {
    ensure_backing_file(disk).await?;

    Ok(format!(
        "storage-node: mock target для {} подготовлен, backing file создан в {}",
        disk.disk_id,
        backing_file_path(disk).display()
    ))
}

async fn mock_delete_target(disk: &DiskPayload) -> Result<String, String> {
    remove_backing_file_if_exists(disk).await?;

    Ok(format!(
        "storage-node: mock cleanup для {} завершён, backing file удалён",
        disk.disk_id
    ))
}

async fn targetcli_create_target(
    disk: &DiskPayload,
    connection: &IscsiConnectionInfo,
) -> Result<String, DriverError> {
    ensure_backing_file(disk)
        .await
        .map_err(DriverError::CommandFailed)?;

    run_targetcli(&format!(
        "/backstores/fileio create name={} file_or_dev={} size={}G write_back=false sparse=true",
        backstore_name(disk),
        backing_file_path(disk).display(),
        disk.size_gb
    ))
    .await?;
    run_targetcli(&format!("/iscsi create {}", connection.target_iqn)).await?;
    run_targetcli(&format!(
        "/iscsi/{}/tpg1/portals create {} {}",
        connection.target_iqn, connection.portal_address, connection.portal_port
    ))
    .await?;
    run_targetcli(&format!(
        "/iscsi/{}/tpg1/luns create /backstores/fileio/{}",
        connection.target_iqn,
        backstore_name(disk)
    ))
    .await?;
    run_targetcli(&format!(
        "/iscsi/{}/tpg1 set attribute authentication=0 demo_mode_write_protect=0 generate_node_acls=1",
        connection.target_iqn
    ))
    .await?;
    let _ = run_targetcli("saveconfig").await?;

    Ok(format!(
        "storage-node: target {} опубликован через targetcli",
        connection.target_iqn
    ))
}

async fn targetcli_delete_target(
    disk: &DiskPayload,
    connection: &IscsiConnectionInfo,
) -> Result<String, DriverError> {
    let _ = run_targetcli_allow_missing(&format!("/iscsi delete {}", connection.target_iqn)).await?;
    let _ = run_targetcli_allow_missing(&format!(
        "/backstores/fileio delete {}",
        backstore_name(disk)
    ))
    .await?;
    let _ = run_targetcli("saveconfig").await?;

    remove_backing_file_if_exists(disk)
        .await
        .map_err(DriverError::CommandFailed)?;

    Ok(format!(
        "storage-node: target {} удалён через targetcli",
        connection.target_iqn
    ))
}

async fn run_targetcli(command: &str) -> Result<String, DriverError> {
    let output = Command::new("targetcli")
        .arg(command)
        .output()
        .await
        .map_err(|err| match err.kind() {
            ErrorKind::NotFound => {
                DriverError::BinaryMissing("targetcli binary is not available".to_owned())
            }
            _ => DriverError::CommandFailed(format!("failed to spawn targetcli: {err}")),
        })?;

    if output.status.success() {
        Ok(read_command_output(&output.stdout, &output.stderr))
    } else {
        Err(DriverError::CommandFailed(format!(
            "targetcli `{command}` failed: {}",
            read_command_output(&output.stdout, &output.stderr)
        )))
    }
}

async fn run_targetcli_allow_missing(command: &str) -> Result<String, DriverError> {
    match run_targetcli(command).await {
        Ok(message) => Ok(message),
        Err(DriverError::CommandFailed(message))
            if message.contains("No such file")
                || message.contains("not found")
                || message.contains("does not exist") =>
        {
            Ok(message)
        }
        Err(err) => Err(err),
    }
}

fn read_command_output(stdout: &[u8], stderr: &[u8]) -> String {
    let stderr = String::from_utf8_lossy(stderr).trim().to_owned();
    if !stderr.is_empty() {
        return stderr;
    }

    String::from_utf8_lossy(stdout).trim().to_owned()
}

fn backstore_name(disk: &DiskPayload) -> String {
    format!("diskhouse-{}", sanitize_name(&disk.disk_id))
}

fn backing_file_path(disk: &DiskPayload) -> PathBuf {
    backing_store_dir().join(format!("{}.img", sanitize_name(&disk.disk_id)))
}

async fn ensure_backing_file(disk: &DiskPayload) -> Result<(), String> {
    fs::create_dir_all(backing_store_dir())
        .await
        .map_err(|err| format!("failed to prepare backing store directory: {err}"))?;

    let path = backing_file_path(disk);
    let file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(&path)
        .await
        .map_err(|err| format!("failed to open backing file {}: {err}", path.display()))?;

    file.set_len(disk_size_bytes(disk))
        .await
        .map_err(|err| format!("failed to size backing file {}: {err}", path.display()))?;

    Ok(())
}

async fn remove_backing_file_if_exists(disk: &DiskPayload) -> Result<(), String> {
    let path = backing_file_path(disk);
    match fs::remove_file(&path).await {
        Ok(_) => Ok(()),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("failed to remove backing file {}: {err}", path.display())),
    }
}

fn disk_size_bytes(disk: &DiskPayload) -> u64 {
    (disk.size_gb.max(1) as u64) * 1024 * 1024 * 1024
}

fn sanitize_name(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect()
}

fn driver_error_message(err: DriverError) -> String {
    match err {
        DriverError::BinaryMissing(message) | DriverError::CommandFailed(message) => {
            format!("storage-node: {message}")
        }
    }
}
