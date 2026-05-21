export type StageOutput = {
  service: string;
  message: string;
};

export type WorkflowResponse = {
  requestId: string;
  complete: boolean;
  updates: StageOutput[];
};

export type TokenPayload = {
  access_token: string;
  refresh_token?: string;
};

export type UserProfile = {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  groups?: string[];
  realm_roles?: string[];
  client_roles?: string[];
  is_admin?: boolean;
};

export type SessionState = {
  accessToken: string;
  refreshToken: string | null;
};

export type DiskIscsiInfo = {
  export_id: string;
  target_iqn: string;
  portal_address: string;
  portal_port: number;
  lun: number;
  auth_type: string;
  discovery_command: string;
  login_command: string;
  device_path: string;
  mount_hint: string;
  status: string;
};

export type DiskSummary = {
  disk_id: string;
  name: string;
  size_gb: number;
  filesystem: string;
  performance_tier: string;
  owner_sub?: string;
  owner_display: string;
  status: string;
  iscsi_status: string;
  updated_at_ms: number;
  iscsi?: DiskIscsiInfo | null;
};

export type MonitoringDeviceSummary = {
  device_name: string;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
  inflight_ios: number;
};

export type MonitoringLogicalDiskSummary = {
  disk_id: string;
  name: string;
  owner_sub: string;
  owner_display: string;
  size_gb: number;
  status: string;
  iscsi_status: string;
  source_device_name: string;
  estimated_share_ratio: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
};

export type MonitoringUserSummary = {
  owner_sub: string;
  owner_display: string;
  disk_count: number;
  total_size_gb: number;
  estimated_share_ratio: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
};

export type MonitoringSystemSummary = {
  active_device_count: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  avg_busy_percent: number;
  peak_busy_percent: number;
  inflight_ios: number;
};

export type MonitoringSnapshot = {
  generated_at_ms: number;
  sample_window_ms: number;
  logical_disks: MonitoringLogicalDiskSummary[];
  users: MonitoringUserSummary[];
  system: MonitoringSystemSummary;
  storage_device: MonitoringDeviceSummary | null;
  physical_disks: MonitoringDeviceSummary[];
};

export type MonitoringHistoryPoint = {
  timestamp: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
};

export type DiskCreateResponse = {
  request_id: string;
  disk_id: string;
};

export type ToastKind = "success" | "error";

export type ToastState = {
  id: number;
  kind: ToastKind;
  message: string;
};

export type DiskFormState = {
  name: string;
  sizeGb: string;
  filesystem: string;
  performanceTier: string;
};

export type AdminUser = {
  id: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  enabled: boolean;
  email_verified: boolean;
  groups: string[];
  is_admin: boolean;
};

export type AdminFormState = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  enabled: boolean;
  isAdmin: boolean;
};

export type AdminSection = "disks" | "users" | "monitoring";

export type TabId = "overview" | "disks";

export type TabOption = {
  id: TabId;
  label: string;
};
