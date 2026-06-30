"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer ?? data.error ?? "No response" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col h-full max-w-2xl mx-auto w-full px-4">
      {/* Header */}
      <header className="py-6 border-b border-white/10">
        <h1 className="text-xl font-semibold tracking-tight">AskElaine</h1>
        <p className="text-sm text-white/40 mt-1">
          Ask me anything about my work and experience.
        </p>
      </header>

      {/* Message list */}
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
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-white/50 px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
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
