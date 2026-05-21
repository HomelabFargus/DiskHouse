export const runtime = "nodejs";

const baseUsersUrl = process.env.ID_ADMIN_USERS_URL ?? "http://id:3001/admin/users";

export async function PUT(
  request: Request,
  context: { params: { userId: string } }
) {
  const authorization = request.headers.get("authorization");
  const body = await request.text();
  const { userId } = context.params;

  const response = await fetch(`${baseUsersUrl}/${userId}`, {
    method: "PUT",
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

export async function DELETE(
  request: Request,
  context: { params: { userId: string } }
) {
  const authorization = request.headers.get("authorization");
  const { userId } = context.params;

  const response = await fetch(`${baseUsersUrl}/${userId}`, {
    method: "DELETE",
    headers: authorization ? { authorization } : {},
    cache: "no-store"
  });

  return new Response(null, {
    status: response.status,
    headers: {
      "cache-control": "no-store"
    }
  });
}
