import { readMonitoringState } from "../../../lib/kafka";

export const runtime = "nodejs";

const authMeUrl = process.env.ID_AUTH_ME_URL ?? "http://id:3001/auth/me";

type IdentityPayload = {
  sub?: string;
  groups?: string[];
  realm_roles?: string[];
  client_roles?: string[];
  is_admin?: boolean;
};

type MonitoringLogicalDiskSummary = {
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

async function readIdentity(authorization: string) {
  const response = await fetch(authMeUrl, {
    method: "GET",
    headers: {
      authorization
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as IdentityPayload;
}

function isAdmin(identity: IdentityPayload | null) {
  if (!identity) {
    return false;
  }

  return Boolean(
    identity.is_admin ||
      identity.groups?.some((group) => group.replace(/^\//, "") === "Admin") ||
      identity.realm_roles?.some((role) => role.toLowerCase() === "admin") ||
      identity.client_roles?.some((role) =>
        ["admin", "manage-users", "query-users", "view-users"].includes(role.toLowerCase())
      )
  );
}

function isIssuedIscsiDisk(disk: MonitoringLogicalDiskSummary) {
  return disk.status === "ready" && disk.iscsi_status === "ready";
}

function rebuildUserSummaries(disks: MonitoringLogicalDiskSummary[]) {
  const grouped = new Map<string, {
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
  }>();

  for (const disk of disks) {
    const current = grouped.get(disk.owner_sub) ?? {
      owner_sub: disk.owner_sub,
      owner_display: disk.owner_display,
      disk_count: 0,
      total_size_gb: 0,
      estimated_share_ratio: 0,
      read_bytes_per_sec: 0,
      write_bytes_per_sec: 0,
      read_iops: 0,
      write_iops: 0,
      throughput_bytes_per_sec: 0,
      total_iops: 0,
      busy_percent: 0
    };

    current.disk_count += 1;
    current.total_size_gb += disk.size_gb;
    current.estimated_share_ratio += disk.estimated_share_ratio;
    current.read_bytes_per_sec += disk.read_bytes_per_sec;
    current.write_bytes_per_sec += disk.write_bytes_per_sec;
    current.read_iops += disk.read_iops;
    current.write_iops += disk.write_iops;
    current.throughput_bytes_per_sec += disk.throughput_bytes_per_sec;
    current.total_iops += disk.total_iops;
    current.busy_percent += disk.busy_percent;

    grouped.set(disk.owner_sub, current);
  }

  return Array.from(grouped.values()).sort(
    (left, right) => right.throughput_bytes_per_sec - left.throughput_bytes_per_sec
  );
}

function rebuildLogicalSystemSummary(disks: MonitoringLogicalDiskSummary[]) {
  return disks.reduce(
    (acc, disk) => {
      acc.read_bytes_per_sec += disk.read_bytes_per_sec;
      acc.write_bytes_per_sec += disk.write_bytes_per_sec;
      acc.read_iops += disk.read_iops;
      acc.write_iops += disk.write_iops;
      acc.throughput_bytes_per_sec += disk.throughput_bytes_per_sec;
      acc.total_iops += disk.total_iops;
      acc.peak_busy_percent = Math.max(acc.peak_busy_percent, disk.busy_percent);
      acc.avg_busy_percent += disk.busy_percent;
      return acc;
    },
    {
      active_device_count: new Set(disks.map((disk) => disk.source_device_name)).size,
      read_bytes_per_sec: 0,
      write_bytes_per_sec: 0,
      read_iops: 0,
      write_iops: 0,
      throughput_bytes_per_sec: 0,
      total_iops: 0,
      avg_busy_percent: 0,
      peak_busy_percent: 0,
      inflight_ios: 0
    }
  );
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const identity = await readIdentity(authorization);
  if (!identity?.sub) {
    return Response.json({ error: "Failed to resolve user profile" }, { status: 401 });
  }

  const snapshot = await readMonitoringState();
  if (!snapshot) {
    return Response.json(
      {
        generated_at_ms: Date.now(),
        sample_window_ms: 0,
        logical_disks: [],
        users: [],
        system: {
          active_device_count: 0,
          read_bytes_per_sec: 0,
          write_bytes_per_sec: 0,
          read_iops: 0,
          write_iops: 0,
          throughput_bytes_per_sec: 0,
          total_iops: 0,
          avg_busy_percent: 0,
          peak_busy_percent: 0,
          inflight_ios: 0
        },
        storage_device: null,
        physical_disks: []
      },
      {
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  }

  const issuedDisks = snapshot.logical_disks.filter(isIssuedIscsiDisk);
  const scopedDisks = isAdmin(identity)
    ? issuedDisks
    : issuedDisks.filter((disk) => disk.owner_sub === identity.sub);
  const users = rebuildUserSummaries(scopedDisks);
  const system = rebuildLogicalSystemSummary(scopedDisks);
  if (scopedDisks.length > 0) {
    system.avg_busy_percent /= scopedDisks.length;
  }

  return Response.json(
    {
      ...snapshot,
      logical_disks: scopedDisks,
      users,
      system,
      storage_device: null,
      physical_disks: []
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
