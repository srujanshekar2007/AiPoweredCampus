"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; text: string };
const suggestions = ["How do I report an issue?", "What does the Digital Twin show?", "How do I use the sustainability dashboard?"];

export default function AssistantDock({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  async function ask(promptValue: string) {
    const prompt = promptValue.trim();
    if (!prompt || loading) return;
    setError("");
    setMessages((previous) => [...previous, { role: "user", text: prompt }]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt }),
      });
      const text = await response.text();
      let data: { answer?: string; error?: string };
      try { data = JSON.parse(text); }
      catch { throw new Error(`Website help returned an unreadable response (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.error ?? `Website help request failed (HTTP ${response.status}).`);
      if (typeof data.answer !== "string") throw new Error("Website help returned an incomplete response.");
      setMessages((previous) => [...previous, { role: "assistant", text: data.answer as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach website help.");
    } finally { setLoading(false); }
  }

  return <aside className="assistant-panel glass-panel" aria-label="EcoTwin website help">
    <div className="assistant-heading"><span className="assistant-spark" aria-hidden="true">✳</span><div><strong>EcoTwin Help</strong><small>Local website guide</small></div><button type="button" className="close-assistant" onClick={onClose} aria-label="Close website help" title="Close help">×</button></div>
    <div className="assistant-messages" aria-live="polite">
      {messages.length === 0 ? <div className="assistant-welcome"><span className="assistant-large" aria-hidden="true">✳</span><p className="eyebrow">WEBSITE HELP</p><h2>How can I help you use EcoTwin?</h2><p>Ask about the website pages and dashboard controls.</p></div> : messages.map((message, index) => <div className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.text}</span></div>)}
      {loading && <div className="assistant-message assistant-loading">Finding a website help answer…</div>}
      {error && <div className="assistant-error" role="alert">{error}</div>}
    </div>
    {messages.length === 0 && <div className="prompt-suggestions"><span>TRY ASKING</span>{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={loading} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>}
    <form className="assistant-dock-form" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
      <div className="chat-input-wrap"><input aria-label="Ask EcoTwin website help" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this website…" maxLength={500} disabled={loading}/><button type="submit" disabled={loading || !question.trim()} aria-label="Send message">➤</button></div>
      <p className="assistant-disclaimer">Local help only. No campus issue data or third-party AI is used.</p>
    </form>
  </aside>;
}
