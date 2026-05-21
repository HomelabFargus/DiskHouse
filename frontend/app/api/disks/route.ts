export const runtime = "nodejs";

const diskServiceUrl = process.env.DISK_SERVICE_URL ?? "http://disk:3003/disks";
const authMeUrl = process.env.ID_AUTH_ME_URL ?? "http://id:3001/auth/me";

type DiskCreatePayload = {
  name: string;
  size_gb: number;
  filesystem: string;
  performance_tier: string;
};

type DiskDeletePayload = {
  disk_id: string;
  request_id?: string;
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

  return response.json();
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

  const url = new URL(diskServiceUrl);
  url.searchParams.set("owner_sub", identity.sub);

  const response = await fetch(url, {
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

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const identity = await readIdentity(authorization);
  if (!identity) {
    return Response.json({ error: "Failed to resolve user profile" }, { status: 401 });
  }

  const payload = (await request.json()) as DiskCreatePayload;
  const requestId = crypto.randomUUID();

  const response = await fetch(diskServiceUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization
    },
    body: JSON.stringify({
      request_id: requestId,
      identity,
      disk: payload
    }),
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
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const identity = await readIdentity(authorization);
  if (!identity?.sub) {
    return Response.json({ error: "Failed to resolve user profile" }, { status: 401 });
  }

  const payload = (await request.json()) as DiskDeletePayload;
  if (!payload.disk_id?.trim()) {
    return Response.json({ error: "disk_id is required" }, { status: 400 });
  }

  const requestId = payload.request_id?.trim() || crypto.randomUUID();
  const url = new URL(diskServiceUrl);
  url.searchParams.set("disk_id", payload.disk_id.trim());
  url.searchParams.set("owner_sub", identity.sub);
  url.searchParams.set("request_id", requestId);

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
