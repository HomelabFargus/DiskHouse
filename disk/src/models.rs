use mongodb::{bson::DateTime, Collection};
use rdkafka::producer::FutureProducer;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::monitoring::IoMonitor;

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) producer: FutureProducer,
    pub(crate) disks: Collection<DiskDocument>,
    pub(crate) io_monitor: Arc<IoMonitor>,
}

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
pub(crate) struct DiskIscsiConnectionSummary {
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

#[derive(Debug, Deserialize)]
pub(crate) struct CreateDiskRequest {
    pub(crate) request_id: String,
    pub(crate) identity: UserIdentity,
    pub(crate) disk: DiskInput,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DiskInput {
    pub(crate) name: String,
    pub(crate) size_gb: i32,
    pub(crate) filesystem: String,
    pub(crate) performance_tier: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ListDisksQuery {
    pub(crate) owner_sub: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DeleteDiskQuery {
    pub(crate) disk_id: String,
    pub(crate) owner_sub: String,
    pub(crate) request_id: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct UpdateDiskOwnerRequest {
    pub(crate) disk_id: String,
    pub(crate) owner_sub: String,
    pub(crate) owner_display: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct CreateDiskResponse {
    pub(crate) request_id: String,
    pub(crate) disk_id: String,
    pub(crate) status: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct DiskSummary {
    pub(crate) disk_id: String,
    pub(crate) name: String,
    pub(crate) size_gb: i32,
    pub(crate) filesystem: String,
    pub(crate) performance_tier: String,
    pub(crate) owner_display: String,
    pub(crate) owner_sub: String,
    pub(crate) status: String,
    pub(crate) iscsi_status: String,
    pub(crate) last_request_id: String,
    pub(crate) created_at_ms: i64,
    pub(crate) updated_at_ms: i64,
    pub(crate) iscsi: Option<DiskIscsiConnectionSummary>,
}

#[derive(Debug, Serialize)]
pub(crate) struct IoMonitoringResponse {
    pub(crate) generated_at_ms: i64,
    pub(crate) sample_window_ms: u64,
    pub(crate) logical_disks: Vec<LogicalDiskIoSummary>,
    pub(crate) users: Vec<UserIoSummary>,
    pub(crate) system: SystemIoSummary,
    pub(crate) storage_device: Option<DeviceIoSummary>,
    pub(crate) physical_disks: Vec<DeviceIoSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct DeviceIoSummary {
    pub(crate) device_name: String,
    pub(crate) read_bytes_per_sec: f64,
    pub(crate) write_bytes_per_sec: f64,
    pub(crate) read_iops: f64,
    pub(crate) write_iops: f64,
    pub(crate) throughput_bytes_per_sec: f64,
    pub(crate) total_iops: f64,
    pub(crate) busy_percent: f64,
    pub(crate) inflight_ios: u64,
}

#[derive(Debug, Serialize)]
pub(crate) struct LogicalDiskIoSummary {
    pub(crate) disk_id: String,
    pub(crate) name: String,
    pub(crate) owner_sub: String,
    pub(crate) owner_display: String,
    pub(crate) size_gb: i32,
    pub(crate) status: String,
    pub(crate) iscsi_status: String,
    pub(crate) source_device_name: String,
    pub(crate) estimated_share_ratio: f64,
    pub(crate) read_bytes_per_sec: f64,
    pub(crate) write_bytes_per_sec: f64,
    pub(crate) read_iops: f64,
    pub(crate) write_iops: f64,
    pub(crate) throughput_bytes_per_sec: f64,
    pub(crate) total_iops: f64,
    pub(crate) busy_percent: f64,
}

#[derive(Debug, Serialize)]
pub(crate) struct UserIoSummary {
    pub(crate) owner_sub: String,
    pub(crate) owner_display: String,
    pub(crate) disk_count: usize,
    pub(crate) total_size_gb: i64,
    pub(crate) estimated_share_ratio: f64,
    pub(crate) read_bytes_per_sec: f64,
    pub(crate) write_bytes_per_sec: f64,
    pub(crate) read_iops: f64,
    pub(crate) write_iops: f64,
    pub(crate) throughput_bytes_per_sec: f64,
    pub(crate) total_iops: f64,
    pub(crate) busy_percent: f64,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct SystemIoSummary {
    pub(crate) active_device_count: usize,
    pub(crate) read_bytes_per_sec: f64,
    pub(crate) write_bytes_per_sec: f64,
    pub(crate) read_iops: f64,
    pub(crate) write_iops: f64,
    pub(crate) throughput_bytes_per_sec: f64,
    pub(crate) total_iops: f64,
    pub(crate) avg_busy_percent: f64,
    pub(crate) peak_busy_percent: f64,
    pub(crate) inflight_ios: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct DiskDocument {
    #[serde(rename = "_id")]
    pub(crate) disk_id: String,
    pub(crate) name: String,
    pub(crate) size_gb: i32,
    pub(crate) filesystem: String,
    pub(crate) performance_tier: String,
    pub(crate) owner_sub: String,
    pub(crate) owner_display: String,
    pub(crate) status: String,
    pub(crate) iscsi_status: String,
    pub(crate) source_service: String,
    pub(crate) last_request_id: String,
    #[serde(default)]
    pub(crate) iscsi: Option<DiskIscsiConnectionSummary>,
    pub(crate) created_at: DateTime,
    pub(crate) updated_at: DateTime,
}
