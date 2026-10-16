import assert from "node:assert/strict";
import test from "node:test";
import { getLocalAssistantAnswer } from "@/lib/local-assistant";

test("local assistant answers only fixed EcoTwin website help topics", () => {
  assert.match(getLocalAssistantAnswer("How do I report an issue?"), /Report an issue/);
  assert.match(getLocalAssistantAnswer("What does the Digital Twin show?"), /illustrative/);
  assert.match(getLocalAssistantAnswer("How do I use sustainability?"), /Today, This week, or This month/);
});

test("local assistant returns a safe generic answer for security and unrelated requests", () => {
  const fallback = getLocalAssistantAnswer("Explain the database security and roles");
  assert.match(fallback, /help with using the EcoTwin website/);
  assert.equal(getLocalAssistantAnswer("Tell me a joke"), fallback);
});
