use mongodb::{bson::DateTime, Collection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct WorkflowEvent {
    pub(crate) request_id: String,
    #[serde(default)]
    pub(crate) operation: WorkflowOperation,
    #[serde(default)]
    pub(crate) identity: Option<UserIdentity>,
    #[serde(default)]
    pub(crate) disk: Option<DiskPayload>,
    pub(crate) outputs: Vec<StageOutput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WorkflowOperation {
    #[default]
    Create,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct UserIdentity {
    pub(crate) sub: String,
    pub(crate) preferred_username: Option<String>,
    pub(crate) email: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) realm_roles: Vec<String>,
    pub(crate) client_roles: Vec<String>,
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
pub(crate) struct FrontendUpdate {
    pub(crate) request_id: String,
    pub(crate) service: String,
    pub(crate) message: String,
    pub(crate) outputs: Vec<StageOutput>,
    pub(crate) complete: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct IscsiExportDocument {
    #[serde(rename = "_id")]
    pub(crate) export_id: String,
    pub(crate) disk_id: String,
    pub(crate) request_id: String,
    pub(crate) owner_sub: String,
    pub(crate) owner_display: String,
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
    pub(crate) source_service: String,
    pub(crate) created_at: DateTime,
    pub(crate) updated_at: DateTime,
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

pub(crate) type ExportCollection = Collection<IscsiExportDocument>;
