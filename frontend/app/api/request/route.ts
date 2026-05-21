export const runtime = "nodejs";

const idServiceUrl = process.env.ID_SERVICE_URL ?? "http://id:3001/request";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization");
  const response = await fetch(idServiceUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {})
    },
    body: JSON.stringify({
      request_id: requestId
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return Response.json(
      {
        error: "Failed to start workflow"
      },
      {
        status: 502
      }
    );
  }

  return Response.json({ requestId });
}
