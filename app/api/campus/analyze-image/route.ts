import { z } from "zod";
import { authConfigured, getAuthenticatedIdentity } from "@/lib/authz";

const schema = z.object({
  imageDataUrl: z.string().max(4_500_000),
});
const categories = ["Water", "Electrical", "Waste", "Grounds", "Safety", "Other"] as const;

export async function POST(request: Request) {
  if (!authConfigured()) return Response.json({ error: "Photo analysis is unavailable because campus authentication is not configured." }, { status: 503 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
  if (identity.role !== "student" && identity.role !== "admin") return Response.json({ error: "A student or administrator account is required." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Upload a smaller image (maximum 3 MB after compression)." }, { status: 400 });

  const match = parsed.data.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return Response.json({ error: "Please upload a JPEG, PNG, or WebP image." }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "AI image analysis is not configured. You can continue and describe the issue manually." }, { status: 503 });

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  if (!/^gemini-[a-zA-Z0-9._-]{2,80}$/.test(model)) return Response.json({ error: "GEMINI_MODEL has an invalid format." }, { status: 503 });
  try {
    const prompt = "Analyze this campus maintenance photo to help a person report an issue. Return ONLY JSON with keys title, description, category, priority, confidence, detected, and needsManualReview. category must be exactly one of Water, Electrical, Waste, Grounds, Safety, Other. For a leaking pipe, hose, faucet, or other water/plumbing issue choose Water. priority must be exactly one of low, medium, high, urgent in lowercase. Do not claim a cause or danger that cannot be seen. If the image is unclear, unrelated, or the issue cannot be confidently identified, set detected=false and needsManualReview=true; make a cautious suggestion only. Confidence is a number from 0 to 1. Keep title under 120 characters and description under 500 characters.";
    const models = [...new Set([model, "gemini-3.6-flash"])];
    let result: any = null;
    let lastStatus: number | null = null;
    for (const attemptModel of models) {
      let upstream: Response;
      try {
        upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(attemptModel)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              { text: prompt },
              { inline_data: { mime_type: match[1], data: match[2] } },
            ] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 800,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingLevel: "low" },
            },
          }),
        });
      } catch (cause) {
        console.error("[campus/analyze-image] Gemini model attempt unavailable", { model: attemptModel, error: cause instanceof Error ? cause.name : "UnknownError" });
        continue;
      }
      if (upstream.ok) {
        const upstreamBody = await upstream.text();
        if (!upstreamBody.trim()) continue;
        try { result = JSON.parse(upstreamBody); break; }
        catch { console.error("[campus/analyze-image] Gemini returned malformed JSON", { model: attemptModel }); continue; }
      }
      lastStatus = upstream.status;
      console.error("[campus/analyze-image] Gemini request failed", { status: upstream.status, model: attemptModel });
      if (upstream.status === 401 || upstream.status === 403) {
        return Response.json({ error: "Photo analysis is unavailable because the Gemini API key is not authorized. Check the server configuration." }, { status: 502 });
      }
      if (![408, 429, 500, 502, 503, 504].includes(upstream.status) && upstream.status !== 404) break;
    }
    if (!result) {
      const message = lastStatus === 429
        ? "Photo analysis is temporarily unavailable because Gemini's request quota was reached. Your photo is still attached; try analysis again shortly or continue manually."
        : lastStatus === 404
          ? "Neither the configured Gemini model nor the backup model is available. Check GEMINI_MODEL and the Gemini API project."
          : "Gemini could not analyze the photo after retrying with a backup vision model. Try again shortly or continue manually.";
      return Response.json({ error: message }, { status: 502 });
    }
    const raw = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    if (!raw.trim()) return Response.json({ error: "Gemini did not return a usable photo analysis. Describe the issue manually." }, { status: 502 });
    const json = JSON.parse(raw);
    const categoryText = typeof json.category === "string" ? json.category.trim().toLowerCase() : "";
    const categoryAliases: Record<string, typeof categories[number]> = {
      water: "Water", plumbing: "Water", leak: "Water", electrical: "Electrical", electricity: "Electrical",
      waste: "Waste", trash: "Waste", rubbish: "Waste", garbage: "Waste", grounds: "Grounds", landscaping: "Grounds",
      safety: "Safety", hazard: "Safety", other: "Other",
    };
    const category = categoryAliases[categoryText] ?? (categories.find((value) => value.toLowerCase() === categoryText) ?? "Other");
    const priorities = ["low", "medium", "high", "urgent"];
    const priorityText = typeof json.priority === "string" ? json.priority.trim().toLowerCase() : "";
    const priority = priorities.includes(priorityText) ? priorityText : "medium";
    return Response.json({
      suggestion: {
        title: typeof json.title === "string" ? json.title.slice(0, 120) : "Campus issue detected",
        description: typeof json.description === "string" ? json.description.slice(0, 500) : "Please describe the issue you observed.",
        category,
        priority,
        confidence: typeof json.confidence === "number" ? Math.max(0, Math.min(1, json.confidence)) : 0,
        detected: json.detected === true,
        needsManualReview: json.needsManualReview !== false,
      },
    });
  } catch (error) {
    console.error("[campus/analyze-image] Gemini request error", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Gemini photo analysis timed out or could not be reached. Your photo is saved in the report form; try analysis again or continue manually." }, { status: 502 });
  }
}
