use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use tokio::{fs, sync::RwLock, time::sleep};
use tracing::{info, warn};

use crate::{
    constants::SERVICE_NAME,
    models::{
        DeviceIoSummary, DiskDocument, IoMonitoringResponse, LogicalDiskIoSummary,
        SystemIoSummary, UserIoSummary,
    },
};

const SECTOR_SIZE_BYTES: f64 = 512.0;
const SAMPLE_INTERVAL: Duration = Duration::from_secs(5);

#[derive(Debug, Clone)]
pub(crate) struct MonitorSnapshot {
    pub(crate) captured_at_ms: i64,
    pub(crate) window_ms: u64,
    pub(crate) devices: Vec<DeviceIoSummary>,
    pub(crate) system: SystemIoSummary,
    pub(crate) storage_device: Option<DeviceIoSummary>,
}

#[derive(Debug, Default)]
struct MonitorState {
    previous: Option<RawSnapshot>,
    current: Option<MonitorSnapshot>,
}

#[derive(Debug)]
pub(crate) struct IoMonitor {
    state: RwLock<MonitorState>,
    backing_store_dir: PathBuf,
}

#[derive(Debug, Clone)]
struct RawSnapshot {
    captured_at: Instant,
    captured_at_ms: i64,
    storage_device_name: Option<String>,
    devices: HashMap<String, RawDiskStats>,
}

#[derive(Debug, Clone, Default)]
struct RawDiskStats {
    name: String,
    reads_completed: u64,
    sectors_read: u64,
    writes_completed: u64,
    sectors_written: u64,
    inflight_ios: u64,
    io_time_ms: u64,
}

impl IoMonitor {
    pub(crate) fn new(backing_store_dir: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            state: RwLock::new(MonitorState::default()),
            backing_store_dir,
        })
    }

    pub(crate) fn spawn(self: Arc<Self>) {
        tokio::spawn(async move {
            loop {
                if let Err(error) = self.sample_once().await {
                    warn!(
                        service = SERVICE_NAME,
                        error = %error,
                        "failed to refresh io monitoring snapshot"
                    );
                }

                sleep(SAMPLE_INTERVAL).await;
            }
        });
    }

    pub(crate) async fn current_snapshot(&self) -> MonitorSnapshot {
        if let Some(snapshot) = self.state.read().await.current.clone() {
            return snapshot;
        }

        if let Err(error) = self.sample_once().await {
            warn!(
                service = SERVICE_NAME,
                error = %error,
                "failed to build on-demand io monitoring snapshot"
            );
        }

        self.state
            .read()
            .await
            .current
            .clone()
            .unwrap_or_else(empty_snapshot)
    }

    async fn sample_once(&self) -> Result<(), String> {
        let raw = read_raw_snapshot(&self.backing_store_dir).await?;

        let mut state = self.state.write().await;
        let next = match state.previous.as_ref() {
            Some(previous) => Some(build_monitor_snapshot(previous, &raw)),
            None => None,
        };

        state.previous = Some(raw);
        if let Some(snapshot) = next {
            state.current = Some(snapshot);
        }

        Ok(())
    }
}

pub(crate) fn build_monitoring_response(
    snapshot: MonitorSnapshot,
    disk_documents: &[DiskDocument],
) -> IoMonitoringResponse {
    let source = snapshot
        .storage_device
        .clone()
        .unwrap_or_else(|| summarize_system_as_device(&snapshot.system));
    let total_size_gb: i64 = disk_documents
        .iter()
        .map(|disk| i64::from(disk.size_gb.max(0)))
        .sum();

    let logical_disks = disk_documents
        .iter()
        .map(|disk| summarize_logical_disk(disk, &source, total_size_gb))
        .collect::<Vec<_>>();
    let users = summarize_users(disk_documents, &source, total_size_gb);

    IoMonitoringResponse {
        generated_at_ms: snapshot.captured_at_ms,
        sample_window_ms: snapshot.window_ms,
        logical_disks,
        users,
        system: snapshot.system,
        storage_device: snapshot.storage_device,
        physical_disks: snapshot.devices,
    }
}

fn build_monitor_snapshot(previous: &RawSnapshot, current: &RawSnapshot) -> MonitorSnapshot {
    let elapsed = current.captured_at.duration_since(previous.captured_at);
    let elapsed_secs = elapsed.as_secs_f64().max(1.0);
    let window_ms = elapsed.as_millis() as u64;

    let mut devices = Vec::new();
    let mut totals = RunningTotals::default();

    for (name, current_stats) in &current.devices {
        let Some(previous_stats) = previous.devices.get(name) else {
            continue;
        };

        let summary = summarize_device(current_stats, previous_stats, elapsed_secs);
        totals.apply(&summary);
        devices.push(summary);
    }

    devices.sort_by(|left, right| {
        right
            .throughput_bytes_per_sec
            .partial_cmp(&left.throughput_bytes_per_sec)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let storage_device = current
        .storage_device_name
        .as_ref()
        .and_then(|name| devices.iter().find(|device| device.device_name == *name))
        .cloned();

    MonitorSnapshot {
        captured_at_ms: current.captured_at_ms,
        window_ms,
        system: totals.finish(),
        devices,
        storage_device,
    }
}

fn summarize_device(
    current: &RawDiskStats,
    previous: &RawDiskStats,
    elapsed_secs: f64,
) -> DeviceIoSummary {
    let read_bytes = saturating_delta(current.sectors_read, previous.sectors_read) as f64
        * SECTOR_SIZE_BYTES;
    let write_bytes = saturating_delta(current.sectors_written, previous.sectors_written) as f64
        * SECTOR_SIZE_BYTES;
    let read_iops = saturating_delta(current.reads_completed, previous.reads_completed) as f64
        / elapsed_secs;
    let write_iops = saturating_delta(current.writes_completed, previous.writes_completed) as f64
        / elapsed_secs;
    let busy_percent = ((saturating_delta(current.io_time_ms, previous.io_time_ms) as f64)
        / (elapsed_secs * 1000.0)
        * 100.0)
        .clamp(0.0, 100.0);

    DeviceIoSummary {
        device_name: current.name.clone(),
        read_bytes_per_sec: read_bytes / elapsed_secs,
        write_bytes_per_sec: write_bytes / elapsed_secs,
        read_iops,
        write_iops,
        throughput_bytes_per_sec: (read_bytes + write_bytes) / elapsed_secs,
        total_iops: read_iops + write_iops,
        busy_percent,
        inflight_ios: current.inflight_ios,
    }
}

fn summarize_system_as_device(system: &SystemIoSummary) -> DeviceIoSummary {
    DeviceIoSummary {
        device_name: "system".to_owned(),
        read_bytes_per_sec: system.read_bytes_per_sec,
        write_bytes_per_sec: system.write_bytes_per_sec,
        read_iops: system.read_iops,
        write_iops: system.write_iops,
        throughput_bytes_per_sec: system.throughput_bytes_per_sec,
        total_iops: system.total_iops,
        busy_percent: system.peak_busy_percent,
        inflight_ios: system.inflight_ios,
    }
}

fn summarize_logical_disk(
    disk: &DiskDocument,
    source: &DeviceIoSummary,
    total_size_gb: i64,
) -> LogicalDiskIoSummary {
    let share = compute_share(i64::from(disk.size_gb.max(0)), total_size_gb);

    LogicalDiskIoSummary {
        disk_id: disk.disk_id.clone(),
        name: disk.name.clone(),
        owner_sub: disk.owner_sub.clone(),
        owner_display: disk.owner_display.clone(),
        size_gb: disk.size_gb,
        status: disk.status.clone(),
        iscsi_status: disk.iscsi_status.clone(),
        source_device_name: source.device_name.clone(),
        estimated_share_ratio: share,
        read_bytes_per_sec: source.read_bytes_per_sec * share,
        write_bytes_per_sec: source.write_bytes_per_sec * share,
        read_iops: source.read_iops * share,
        write_iops: source.write_iops * share,
        throughput_bytes_per_sec: source.throughput_bytes_per_sec * share,
        total_iops: source.total_iops * share,
        busy_percent: source.busy_percent * share,
    }
}

fn summarize_users(
    disks: &[DiskDocument],
    source: &DeviceIoSummary,
    total_size_gb: i64,
) -> Vec<UserIoSummary> {
    let mut grouped: HashMap<String, Vec<&DiskDocument>> = HashMap::new();

    for disk in disks {
        grouped
            .entry(disk.owner_sub.clone())
            .or_default()
            .push(disk);
    }

    let mut users = grouped
        .into_iter()
        .map(|(owner_sub, user_disks)| {
            let total_user_size_gb: i64 = user_disks
                .iter()
                .map(|disk| i64::from(disk.size_gb.max(0)))
                .sum();
            let share = compute_share(total_user_size_gb, total_size_gb);
            let owner_display = user_disks
                .first()
                .map(|disk| disk.owner_display.clone())
                .unwrap_or_else(|| owner_sub.to_owned());

            UserIoSummary {
                owner_sub: owner_sub.to_owned(),
                owner_display,
                disk_count: user_disks.len(),
                total_size_gb: total_user_size_gb,
                estimated_share_ratio: share,
                read_bytes_per_sec: source.read_bytes_per_sec * share,
                write_bytes_per_sec: source.write_bytes_per_sec * share,
                read_iops: source.read_iops * share,
                write_iops: source.write_iops * share,
                throughput_bytes_per_sec: source.throughput_bytes_per_sec * share,
                total_iops: source.total_iops * share,
                busy_percent: source.busy_percent * share,
            }
        })
        .collect::<Vec<_>>();

    users.sort_by(|left, right| {
        right
            .throughput_bytes_per_sec
            .partial_cmp(&left.throughput_bytes_per_sec)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    users
}

fn compute_share(size_gb: i64, total_size_gb: i64) -> f64 {
    if total_size_gb <= 0 {
        return 0.0;
    }

    (size_gb.max(0) as f64 / total_size_gb as f64).clamp(0.0, 1.0)
}

#[derive(Debug, Default)]
struct RunningTotals {
    active_device_count: usize,
    read_bytes_per_sec: f64,
    write_bytes_per_sec: f64,
    read_iops: f64,
    write_iops: f64,
    busy_percent_sum: f64,
    peak_busy_percent: f64,
    inflight_ios: u64,
}

impl RunningTotals {
    fn apply(&mut self, device: &DeviceIoSummary) {
        self.active_device_count += 1;
        self.read_bytes_per_sec += device.read_bytes_per_sec;
        self.write_bytes_per_sec += device.write_bytes_per_sec;
        self.read_iops += device.read_iops;
        self.write_iops += device.write_iops;
        self.busy_percent_sum += device.busy_percent;
        self.peak_busy_percent = self.peak_busy_percent.max(device.busy_percent);
        self.inflight_ios += device.inflight_ios;
    }

    fn finish(self) -> SystemIoSummary {
        let avg_busy_percent = if self.active_device_count == 0 {
            0.0
        } else {
            self.busy_percent_sum / self.active_device_count as f64
        };

        SystemIoSummary {
            active_device_count: self.active_device_count,
            read_bytes_per_sec: self.read_bytes_per_sec,
            write_bytes_per_sec: self.write_bytes_per_sec,
            read_iops: self.read_iops,
            write_iops: self.write_iops,
            throughput_bytes_per_sec: self.read_bytes_per_sec + self.write_bytes_per_sec,
            total_iops: self.read_iops + self.write_iops,
            avg_busy_percent,
            peak_busy_percent: self.peak_busy_percent,
            inflight_ios: self.inflight_ios,
        }
    }
}

async fn read_raw_snapshot(backing_store_dir: &Path) -> Result<RawSnapshot, String> {
    let diskstats = fs::read_to_string("/proc/diskstats")
        .await
        .map_err(|error| format!("failed to read /proc/diskstats: {error}"))?;
    let storage_device_name = resolve_storage_device_name(backing_store_dir).await;

    Ok(RawSnapshot {
        captured_at: Instant::now(),
        captured_at_ms: now_ms(),
        storage_device_name,
        devices: parse_diskstats(&diskstats),
    })
}

fn parse_diskstats(content: &str) -> HashMap<String, RawDiskStats> {
    let mut devices = HashMap::new();

    for line in content.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 14 {
            continue;
        }

        let name = fields[2].to_owned();
        if !is_top_level_device(&name) || is_virtual_device(&name) {
            continue;
        }

        let stats = RawDiskStats {
            name: name.clone(),
            reads_completed: parse_u64(fields[3]),
            sectors_read: parse_u64(fields[5]),
            writes_completed: parse_u64(fields[7]),
            sectors_written: parse_u64(fields[9]),
            inflight_ios: parse_u64(fields[11]),
            io_time_ms: parse_u64(fields[12]),
        };

        devices.insert(name, stats);
    }

    devices
}

fn is_top_level_device(name: &str) -> bool {
    Path::new("/sys/block").join(name).exists()
}

fn is_virtual_device(name: &str) -> bool {
    ["loop", "ram", "fd", "sr", "zram"]
        .iter()
        .any(|prefix| name.starts_with(prefix))
}

async fn resolve_storage_device_name(backing_store_dir: &Path) -> Option<String> {
    let mountinfo = fs::read_to_string("/proc/self/mountinfo").await.ok()?;
    let canonical = fs::canonicalize(backing_store_dir)
        .await
        .unwrap_or_else(|_| backing_store_dir.to_path_buf());
    let mount_point = find_mount_point(&mountinfo, &canonical)?;
    let device_id = find_mount_device_id(&mountinfo, &mount_point)?;

    Some(device_name_from_device_id(&device_id))
}

fn find_mount_point(mountinfo: &str, path: &Path) -> Option<PathBuf> {
    let mut best_match: Option<PathBuf> = None;

    for line in mountinfo.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 5 {
            continue;
        }

        let mount_point = PathBuf::from(unescape_mount_field(fields[4]));
        if path.starts_with(&mount_point) {
            let replace = best_match
                .as_ref()
                .map(|current| mount_point.as_os_str().len() > current.as_os_str().len())
                .unwrap_or(true);
            if replace {
                best_match = Some(mount_point);
            }
        }
    }

    best_match
}

fn find_mount_device_id(mountinfo: &str, mount_point: &Path) -> Option<String> {
    for line in mountinfo.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 5 {
            continue;
        }

        if PathBuf::from(unescape_mount_field(fields[4])) == mount_point {
            return Some(fields[2].to_owned());
        }
    }

    None
}

fn device_name_from_device_id(device_id: &str) -> String {
    if let Some(link_target) = std::fs::read_link(format!("/sys/dev/block/{device_id}")).ok() {
        if let Some(name) = link_target.file_name().and_then(|value| value.to_str()) {
            return name.to_owned();
        }
    }

    device_id.replace(':', "_")
}

fn unescape_mount_field(value: &str) -> String {
    value
        .replace("\\040", " ")
        .replace("\\011", "\t")
        .replace("\\012", "\n")
        .replace("\\134", "\\")
}

fn saturating_delta(current: u64, previous: u64) -> u64 {
    current.saturating_sub(previous)
}

fn parse_u64(value: &str) -> u64 {
    value.parse::<u64>().unwrap_or_default()
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn empty_snapshot() -> MonitorSnapshot {
    info!(
        service = SERVICE_NAME,
        "io monitoring snapshot requested before sampler collected a delta"
    );

    MonitorSnapshot {
        captured_at_ms: now_ms(),
        window_ms: 0,
        devices: Vec::new(),
        system: SystemIoSummary {
            active_device_count: 0,
            read_bytes_per_sec: 0.0,
            write_bytes_per_sec: 0.0,
            read_iops: 0.0,
            write_iops: 0.0,
            throughput_bytes_per_sec: 0.0,
            total_iops: 0.0,
            avg_busy_percent: 0.0,
            peak_busy_percent: 0.0,
            inflight_ios: 0,
        },
        storage_device: None,
    }
}
