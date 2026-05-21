export const runtime = "nodejs";

const meUrl = process.env.ID_AUTH_ME_URL ?? "http://id:3001/auth/me";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  const response = await fetch(meUrl, {
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
