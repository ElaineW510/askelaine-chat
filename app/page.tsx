"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text }]);
    // Reserve a slot for the streaming reply
    setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId.current }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { role: "assistant", text: `Error: ${err.error ?? "Unknown error"}` }
              : m
          )
        );
        return;
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let chunk: { text?: string; sessionId?: string; done?: boolean; answer?: string; error?: string };
          try { chunk = JSON.parse(raw); } catch { continue; }

          // Capture session ID for conversation continuity
          if (chunk.sessionId) sessionId.current = chunk.sessionId;

          // Handle both streaming (text delta) and non-streaming (answer) responses
          const content = chunk.text ?? chunk.answer;
          if (content) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, text: m.text + content }
                  : m
              )
            );
          }

          if (chunk.error) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1
                  ? { role: "assistant", text: `Error: ${chunk.error}` }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { role: "assistant", text: `Error: ${msg}` }
            : m
        )
      );
    } finally {
      // Mark the assistant message as no longer streaming
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, streaming: false } : m
        )
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col h-full max-w-2xl mx-auto w-full px-4">
      <header className="py-6 border-b border-white/10">
        <h1 className="text-xl font-semibold tracking-tight">AskElaine</h1>
        <p className="text-sm text-white/40 mt-1">
          Ask me anything about my work and experience.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <p className="text-white/30 text-sm text-center mt-12">
            Say hello to get started.
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-white text-black rounded-br-sm"
                  : "bg-white/10 text-white/90 rounded-bl-sm"
              }`}
            >
              {m.text || (m.streaming ? "…" : "")}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="py-4 border-t border-white/10 flex gap-3">
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder-white/30 focus:border-white/30 transition-colors"
          placeholder="Ask me anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-white text-black px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-white/90 transition-colors"
        >
          Send
        </button>
      </div>
    </main>
  );
}
