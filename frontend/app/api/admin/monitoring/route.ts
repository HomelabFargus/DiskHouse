import { readMonitoringState } from "../../../../lib/kafka";

export const runtime = "nodejs";

const authMeUrl = process.env.ID_AUTH_ME_URL ?? "http://id:3001/auth/me";

type IdentityPayload = {
  sub?: string;
  groups?: string[];
  realm_roles?: string[];
  client_roles?: string[];
  is_admin?: boolean;
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

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const identity = await readIdentity(authorization);
  if (!isAdmin(identity)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
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

  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
