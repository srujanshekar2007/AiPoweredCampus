import assert from "node:assert/strict";
import test from "node:test";
import { submitIssueReport, validateIssueReportPayload } from "../lib/issue-report-client";
import { createIssuePostHandler } from "../lib/issue-report-route";

const payload = {
  title: "Overflowing recycling bin",
  description: "The recycling bin is full and waste is on the ground.",
  category: "Waste",
  location: "Building 2 · Floor 2 · Room 203",
  locationSelection: { buildingId: "building-id", floorId: "floor-id", roomId: "room-id" },
  priority: "medium",
  evidence: ["data:image/jpeg;base64,AA=="],
};

function post(handler: (request: Request) => Promise<Response>, body: unknown = payload) {
  return handler(new Request("http://localhost/api/campus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

test("client rejects missing required location and report fields", () => {
  assert.throws(() => validateIssueReportPayload({ ...payload, locationSelection: null }), /Choose a building, floor, and room/);
  assert.throws(() => validateIssueReportPayload({ ...payload, title: "", evidence: [] }), /Complete the report details/);
});

test("API saves to its injected main issue store using the signed-in identity", async () => {
  let savedInput: unknown;
  let savedReporter: unknown;
  const handler = createIssuePostHandler({
    authConfigured: () => true,
    getAuthenticatedIdentity: async () => ({ role: "student", id: "session-user-id", name: "Student Name" }),
    createIssue: async (input, reporter) => { savedInput = input; savedReporter = reporter; return { id: "ET-12345678" }; },
  });
  const response = await post(handler);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { issue: { id: "ET-12345678" } });
  assert.equal((savedInput as { location: string }).location, payload.location);
  assert.deepEqual(savedReporter, { id: "session-user-id", name: "Student Name" });
  assert.equal("locationSelection" in (savedInput as object), false);
});

test("API rejects missing building, floor, or room before calling the store", async () => {
  let createCalled = false;
  const handler = createIssuePostHandler({
    authConfigured: () => true,
    getAuthenticatedIdentity: async () => ({ role: "student", id: "session-user-id", name: "Student Name" }),
    createIssue: async () => { createCalled = true; return { id: "unexpected" }; },
  });
  const response = await post(handler, { ...payload, locationSelection: { buildingId: "building-id", floorId: "", roomId: "room-id" } });
  assert.equal(response.status, 400);
  assert.equal(createCalled, false);
});

test("API rejects missing or expired authentication", async () => {
  const handler = createIssuePostHandler({ authConfigured: () => true, getAuthenticatedIdentity: async () => null, createIssue: async () => ({ id: "unused" }) });
  const response = await post(handler);
  assert.equal(response.status, 401);
});

test("API returns a clear failure if Supabase rejects the insert", async () => {
  const handler = createIssuePostHandler({
    authConfigured: () => true,
    getAuthenticatedIdentity: async () => ({ role: "student", id: "session-user-id", name: "Student Name" }),
    createIssue: async () => { throw Object.assign(new Error("new row violates row-level security policy for table campus_issues"), { code: "42501" }); },
  });
  const response = await post(handler);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /row-level security/);
});

test("API distinguishes a missing table grant from an RLS row rejection", async () => {
  const handler = createIssuePostHandler({
    authConfigured: () => true,
    getAuthenticatedIdentity: async () => ({ role: "student", id: "session-user-id", name: "Student Name" }),
    createIssue: async () => { throw Object.assign(new Error("permission denied for table campus_issues"), { code: "42501" }); },
  });
  const response = await post(handler);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /missing access to campus_issues/);
});

test("client parses success only when the API confirms a saved report", async () => {
  const issue = await submitIssueReport(payload, async () => Response.json({ issue: { id: "ET-87654321" } }, { status: 201 }));
  assert.equal(issue.id, "ET-87654321");
  await assert.rejects(submitIssueReport(payload, async () => new Response("server proxy error", { status: 502 })), /unreadable response/);
  await assert.rejects(submitIssueReport(payload, async () => Response.json({ error: "not saved" }, { status: 503 })), /not saved/);
});

test("client reports network failures and request timeouts instead of waiting forever", async () => {
  await assert.rejects(submitIssueReport(payload, async () => { throw new TypeError("offline"); }), /Check your connection/);
  await assert.rejects(submitIssueReport(payload, (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }), 5), /timed out/);
});

test("client can retry after a failed attempt", async () => {
  let attempts = 0;
  const retryableFetch: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) return Response.json({ error: "temporary database error" }, { status: 503 });
    return Response.json({ issue: { id: "ET-RETRY01" } }, { status: 201 });
  };
  await assert.rejects(submitIssueReport(payload, retryableFetch), /temporary database error/);
  const issue = await submitIssueReport(payload, retryableFetch);
  assert.equal(issue.id, "ET-RETRY01");
  assert.equal(attempts, 2);
});
