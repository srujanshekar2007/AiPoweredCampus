import { authConfigured, getAuthenticatedIdentity } from "@/lib/authz";
import { getLocalAssistantAnswer } from "@/lib/local-assistant";
import { z } from "zod";

const schema = z.object({ question: z.string().trim().min(1).max(500) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a question about using the EcoTwin website." }, { status: 400 });
  if (!authConfigured()) return Response.json({ error: "Sign in is currently unavailable." }, { status: 503 });
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
  } catch {
    return Response.json({ error: "Your campus account could not be checked. Try again later." }, { status: 503 });
  }

  // This local FAQ uses only fixed website help text; it never reads campus records
  // or sends the question to a third-party service.
  return Response.json({ answer: getLocalAssistantAnswer(parsed.data.question), citations: [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
