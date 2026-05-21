export const runtime = "nodejs";

const usersUrl = process.env.ID_ADMIN_USERS_URL ?? "http://id:3001/admin/users";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  const response = await fetch(usersUrl, {
    method: "GET",
    headers: authorization ? { authorization } : {},
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
  const body = await request.text();

  const response = await fetch(usersUrl, {
    method: "POST",
    headers: {
      ...(authorization ? { authorization } : {}),
      "content-type": "application/json"
    },
    body,
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
