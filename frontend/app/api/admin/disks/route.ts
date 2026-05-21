export const runtime = "nodejs";

const diskServiceUrl = process.env.DISK_SERVICE_URL ?? "http://disk:3003/disks";
const authMeUrl = process.env.ID_AUTH_ME_URL ?? "http://id:3001/auth/me";

type AdminDiskDeletePayload = {
  disk_id: string;
  owner_sub: string;
  request_id?: string;
};

type AdminDiskOwnerPayload = {
  disk_id: string;
  owner_sub: string;
  owner_display: string;
};

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

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return {
      authorization: null,
      identity: null,
      response: Response.json({ error: "Missing Authorization header" }, { status: 401 })
    };
  }

  const identity = await readIdentity(authorization);
  if (!isAdmin(identity)) {
    return {
      authorization,
      identity,
      response: Response.json({ error: "Admin access required" }, { status: 403 })
    };
  }

  return { authorization, identity, response: null };
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) {
    return access.response;
  }

  const response = await fetch(diskServiceUrl, {
    method: "GET",
    cache: "no-store"
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store"
    }
  });
}

export async function PUT(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) {
    return access.response;
  }

  const payload = (await request.json()) as AdminDiskOwnerPayload;

  const response = await fetch(diskServiceUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store"
    }
  });
}

export async function DELETE(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) {
    return access.response;
  }

  const payload = (await request.json()) as AdminDiskDeletePayload;
  if (!payload.disk_id?.trim() || !payload.owner_sub?.trim()) {
    return Response.json(
      { error: "disk_id and owner_sub are required" },
      { status: 400 }
    );
  }

  const url = new URL(diskServiceUrl);
  url.searchParams.set("disk_id", payload.disk_id.trim());
  url.searchParams.set("owner_sub", payload.owner_sub.trim());
  url.searchParams.set("request_id", payload.request_id?.trim() || crypto.randomUUID());

  const response = await fetch(url, {
    method: "DELETE",
    cache: "no-store"
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store"
    }
  });
}
