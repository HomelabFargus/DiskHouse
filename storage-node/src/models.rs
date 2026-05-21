use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WorkflowOperation {
    #[default]
    Create,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct DiskPayload {
    pub(crate) disk_id: String,
    pub(crate) name: String,
    pub(crate) size_gb: i32,
    pub(crate) filesystem: String,
    pub(crate) performance_tier: String,
    pub(crate) owner_sub: String,
    pub(crate) owner_display: String,
    pub(crate) status: String,
    pub(crate) iscsi_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct IscsiConnectionInfo {
    pub(crate) export_id: String,
    pub(crate) target_iqn: String,
    pub(crate) portal_address: String,
    pub(crate) portal_port: i32,
    pub(crate) lun: i32,
    pub(crate) auth_type: String,
    pub(crate) discovery_command: String,
    pub(crate) login_command: String,
    pub(crate) device_path: String,
    pub(crate) mount_hint: String,
    pub(crate) status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct StageOutput {
    pub(crate) service: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct StorageNodeCommand {
    pub(crate) request_id: String,
    pub(crate) operation: WorkflowOperation,
    pub(crate) disk: DiskPayload,
    pub(crate) connection: IscsiConnectionInfo,
    pub(crate) outputs: Vec<StageOutput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct StorageNodeResponse {
    pub(crate) request_id: String,
    pub(crate) operation: WorkflowOperation,
    pub(crate) disk: DiskPayload,
    pub(crate) connection: IscsiConnectionInfo,
    pub(crate) success: bool,
    pub(crate) message: String,
    pub(crate) outputs: Vec<StageOutput>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DriverMode {
    Auto,
    TargetCli,
    Mock,
}

#[derive(Debug)]
pub(crate) enum DriverError {
    BinaryMissing(String),
    CommandFailed(String),
}
