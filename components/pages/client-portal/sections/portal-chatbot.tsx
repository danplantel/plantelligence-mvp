"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import { readableColor } from "polished";
import { useOptionalClientPortal } from "@/contexts/client-portal-context";

/**
 * Portal chatbot — a floating action button in the bottom-right corner that opens
 * a chat sheet.
 *
 * UI only for now: the composer appends what the visitor types to the local
 * transcript and stops there. The assistant itself (streaming reply, retrieval over
 * the plan's benefits, hand-off to a real person) is wired in `send()` later.
 */

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}

const GREETING =
  "Hi! I'm your benefits assistant. Ask me anything about your plan — coverage, enrollment, claims, or your retirement account.";

export interface PortalChatbotProps {
  brandColor?: string;
  /** Accent used for the send button, matching the portal's CTAs. */
  secondaryColor?: string;
}

export function PortalChatbot({
  brandColor: brandColorProp,
  secondaryColor: secondaryColorProp,
}: PortalChatbotProps) {
  // The plan's own colours, exactly as the rest of the portal chrome reads them.
  // `useOptionalClientPortal` keeps this safe when rendered outside the provider
  // (tests, previews), where it falls back to the portal defaults.
  const { clientData } = useOptionalClientPortal();
  const brandColor = brandColorProp || clientData?.brandColor || "#1F3A60";
  const secondaryColor =
    secondaryColorProp || clientData?.secondaryColor || "#6B7280";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", text: GREETING },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the composer when the sheet opens, so typing works immediately.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /** Append the visitor's message. The assistant's reply is not wired yet. */
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: prev.length, role: "user", text },
    ]);
    setDraft("");
  };

  // Sit clear of an open Comments / Messages rail, which occupies the right-hand
  // column and sets these variables on the portal root.
  const edgeStyle: React.CSSProperties = {
    right:
      "max(1.25rem, calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.25rem))",
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="portal-chatbot-sheet"
            id="portal-chatbot"
            role="dialog"
            aria-modal="false"
            aria-label="Benefits assistant"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            // Above the comments/messages rails, and clear of the FAB below
            // (which itself sits above the mobile "get the app" bar).
            className="fixed bottom-[10rem] z-[60] flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.28)] md:bottom-[5.5rem]"
            style={edgeStyle}
          >
            {/* Header — the portal's brand colour, like its other chrome. */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{
                backgroundColor: brandColor,
                color: readableColor(brandColor),
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-red-hat text-sm font-semibold">
                    Benefits assistant
                  </p>
                  <p
                    className="truncate font-red-hat text-[11px]"
                    style={{ color: readableColor(brandColor), opacity: 0.75 }}
                  >
                    Ask about your plan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the benefits assistant"
                className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/15"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Transcript */}
            <div
              ref={listRef}
              data-testid="portal-chatbot-transcript"
              className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <p
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 font-red-hat text-[13px] leading-relaxed text-white"
                        : "max-w-[85%] rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-3.5 py-2 font-red-hat text-[13px] leading-relaxed text-neutral-700"
                    }
                    style={
                      message.role === "user"
                        ? { backgroundColor: brandColor }
                        : undefined
                    }
                  >
                    {message.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Composer */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 py-3"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Type your question"
                placeholder="Type your question…"
                className="h-10 min-w-0 flex-1 rounded-full border border-neutral-300 bg-white px-3.5 font-red-hat text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send your question"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  backgroundColor: secondaryColor,
                  color: readableColor(secondaryColor),
                }}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button. Closed it is a pill — the icon plus the "Ask a
          question" label, so the action says what it does instead of being a bare
          glyph. Open it collapses back to the X: keeping the label would describe
          the opposite of what pressing it now does. The label is inside the button,
          so the whole pill stays one target (and one accessible name, from the
          `aria-label`). */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        // Distinct from the header's close button, so the two never share an
        // accessible name.
        aria-label={open ? "Close chat" : "Ask a question"}
        aria-expanded={open}
        aria-controls="portal-chatbot"
        // `bottom-24` clears the mobile "get the app" bar; desktop uses the corner.
        className={`fixed bottom-24 z-[60] flex h-14 items-center justify-center gap-2 rounded-full text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)] transition-transform hover:scale-105 print:hidden md:bottom-6 ${
          open ? "w-14" : "px-5"
        }`}
        style={{
          ...edgeStyle,
          backgroundColor: brandColor,
          color: readableColor(brandColor),
        }}
      >
        {open ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span
              data-testid="portal-chatbot-fab-label"
              className="whitespace-nowrap font-red-hat text-sm font-semibold leading-none"
            >
              Ask a question
            </span>
          </>
        )}
      </button>
    </>
  );
}
