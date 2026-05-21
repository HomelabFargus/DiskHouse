export const runtime = "nodejs";

const loginUrl = process.env.ID_AUTH_LOGIN_URL ?? "http://id:3001/auth/login";

export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
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
