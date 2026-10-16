import type { TwinLocationSelection } from "@/components/twin/types";

export type IssueReportPayload = {
  title: string;
  description: string;
  category: string;
  location: string;
  locationSelection: Omit<TwinLocationSelection, "location"> | null;
  priority: string;
  evidence: string[];
};

type SavedIssueResponse = { issue?: { id?: string }; error?: string };

export function validateIssueReportPayload(payload: IssueReportPayload) {
  if (!payload.title.trim() || !payload.description.trim() || !payload.category || !payload.priority || !payload.evidence.length) {
    throw new Error("Complete the report details and attach a photo before submitting.");
  }
  const selection = payload.locationSelection;
  if (!selection?.buildingId || !selection.floorId || !selection.roomId || !payload.location.trim()) {
    throw new Error("Choose a building, floor, and room using the options or Digital Twin before submitting.");
  }
}

export async function submitIssueReport(
  payload: IssueReportPayload,
  request: typeof fetch = fetch,
  timeoutMs = 45_000,
) {
  validateIssueReportPayload(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("The report request timed out.", "TimeoutError")), timeoutMs);
  try {
    const response = await request("/api/campus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsedBody: unknown = {};
    if (text) {
      try {
        parsedBody = JSON.parse(text) as unknown;
      } catch {
        throw new Error(`Report service returned an unreadable response (HTTP ${response.status}).`);
      }
    }
    const body: SavedIssueResponse = typeof parsedBody === "object" && parsedBody !== null
      ? parsedBody as SavedIssueResponse
      : {};
    if (!response.ok) throw new Error(body.error ?? `Report submission failed (HTTP ${response.status}).`);
    if (!body.issue?.id) throw new Error("The server did not confirm that the report was saved. Refresh your reports before retrying.");
    return body.issue;
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error("Report submission timed out. Check My Reports before retrying in case the server saved it.");
    }
    if (cause instanceof TypeError) {
      throw new Error("Could not reach the report service. Check your connection and try again.");
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}
