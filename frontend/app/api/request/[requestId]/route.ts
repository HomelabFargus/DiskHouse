import { readWorkflowState } from "../../../../lib/kafka";

export const runtime = "nodejs";

type Context = {
  params: {
    requestId: string;
  };
};

export async function GET(_request: Request, { params }: Context) {
  return Response.json(await readWorkflowState(params.requestId), {
    headers: {
      "cache-control": "no-store"
    }
  });
}
