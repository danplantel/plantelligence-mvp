"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import { readableColor } from "polished";
import useSWR from "swr";

import { useOptionalClientPortal } from "@/contexts/client-portal-context";
import { customBenefitTitleFromHubs } from "@/lib/benefit-custom-name";
import {
  ASSISTANT_ASK_EVENT,
  buildAssistantCorpus,
  buildAssistantHubs,
  respondToHub,
  respondToQuestion,
  respondToTopic,
  type AssistantHub,
  type AssistantIndex,
  type AssistantLink,
  type AssistantPlan,
  type AssistantPlacement,
  type AssistantReply,
  type AssistantSuggestion,
} from "@/lib/topics/assistant";
import type { TopicLocation } from "@/types/topic";

/**
 * Portal chatbot — a floating action button in the bottom-right corner that opens a
 * benefits assistant.
 *
 * The answers are deterministic and grounded: `lib/topics/assistant` scores the
 * question against every topic in the shipped library plus this plan's placements,
 * and replies with the topic's own quick answer, steps, CTA and a deep link. Nothing
 * is generated, and no request leaves the portal.
 *
 * The plan index is loaded lazily, the first time the sheet opens (or the FAB is
 * hovered/focused), from `GET /api/clients/[id]/portal/assistant?forPortal=1`. Until
 * it arrives the assistant says it is typing; if the read fails it still answers from
 * the shipped library, which is already in the bundle, with hub links only.
 *
 * The shell is deliberately unchanged: same FAB, sheet, colours, Escape handling and
 * clear of the comments/messages rails.
 */

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text?: string;
  reply?: AssistantReply;
}

interface AssistantIndexPayload {
  topics?: AssistantPlacement[];
  hiddenSlugs?: string[];
}

const GREETING =
  "Hi! I'm your benefits assistant. Ask me anything about your plan — coverage, enrollment, claims, or your retirement account.";

/** How long a conversation lasts before the sheet starts over. */
export const CHAT_SESSION_MS = 60 * 60 * 1000;

/** Breathing room above the question the transcript pins to its top. */
const SCROLL_QUESTION_GAP = 12;

function sessionKey(clientId: string): string {
  return `portal-chatbot-session:v1:${clientId}`;
}

function isStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as {
    id?: unknown;
    role?: unknown;
    text?: unknown;
    reply?: unknown;
  };
  if (typeof record.id !== "number") return false;
  if (record.role !== "user" && record.role !== "assistant") return false;
  return (
    typeof record.text === "string" ||
    (record.reply !== null && typeof record.reply === "object")
  );
}

function readStoredSession(
  key: string,
): { startedAt: number; messages: ChatMessage[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      startedAt?: unknown;
      messages?: unknown;
    };
    if (
      typeof parsed.startedAt !== "number" ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }
    const messages = parsed.messages.filter(isStoredMessage);
    if (messages.length === 0) return null;
    return { startedAt: parsed.startedAt, messages };
  } catch {
    return null;
  }
}

function writeStoredSession(
  key: string,
  session: { startedAt: number; messages: ChatMessage[] },
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // Storage can be unavailable or full; the conversation still works in memory.
  }
}

function clearStoredSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then((response) => response.json());

/** The first contact that carries an email or a phone, however `keyContacts` is stored. */
function contactChannels(keyContacts: unknown): {
  email?: string;
  phone?: string;
} {
  const list: unknown[] = Array.isArray(keyContacts)
    ? keyContacts
    : keyContacts &&
        typeof keyContacts === "object" &&
        Array.isArray((keyContacts as { contacts?: unknown[] }).contacts)
      ? ((keyContacts as { contacts: unknown[] }).contacts ?? [])
      : [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { email?: unknown; phone?: unknown };
    const email = typeof record.email === "string" ? record.email.trim() : "";
    const phone = typeof record.phone === "string" ? record.phone.trim() : "";
    if (email || phone) {
      return {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      };
    }
  }
  return {};
}

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
  const { clientData, profile } = useOptionalClientPortal();
  const params = useParams();
  const paramId = params?.id;
  const clientId =
    (Array.isArray(paramId) ? paramId[0] : paramId) || clientData?.id || "";

  const brandColor = brandColorProp || clientData?.brandColor || "#1F3A60";
  const secondaryColor =
    secondaryColorProp || clientData?.secondaryColor || "#6B7280";

  const [open, setOpen] = useState(false);
  /** A hover/focus on the FAB starts the index fetch before the sheet opens. */
  const [warm, setWarm] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", text: GREETING },
  ]);
  /**
   * The turn waiting on the plan index, then on the typing pause. A hub turn is a
   * benefit button the visitor pressed rather than a typed question; it gets its own
   * reply, so pressing "Retirement" starts a conversation instead of leaving the page.
   */
  const [pending, setPending] = useState<{
    question: string;
    hub?: TopicLocation;
    /** A chip the visitor pressed: answer THIS topic, not a fresh search. */
    topic?: { slug: string; location: TopicLocation };
  } | null>(null);
  const [typing, setTyping] = useState(false);
  const nextMessageId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * When this conversation began; it lasts CHAT_SESSION_MS from here. `null` means the
   * sheet has not been opened yet in this visit, so loading a portal page never starts
   * the clock.
   */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const storageKey = clientId ? sessionKey(clientId) : null;

  // Restore a conversation that is still inside its hour. The read happens after
  // mount — never in the initial state — so the server-rendered greeting and the
  // first client render agree.
  useEffect(() => {
    if (!storageKey) {
      setSessionReady(true);
      return;
    }
    const stored = readStoredSession(storageKey);
    if (stored && Date.now() < stored.startedAt + CHAT_SESSION_MS) {
      setMessages(stored.messages);
      setStartedAt(stored.startedAt);
      nextMessageId.current =
        stored.messages.reduce(
          (max, message) => Math.max(max, message.id),
          0,
        ) + 1;
    } else {
      clearStoredSession(storageKey);
    }
    setSessionReady(true);
  }, [storageKey]);

  // The first open starts the clock. Opening again inside the hour keeps it.
  useEffect(() => {
    if (!open || !sessionReady) return;
    setStartedAt((current) => current ?? Date.now());
  }, [open, sessionReady]);

  // Persist on every change, once the restore has had its say.
  useEffect(() => {
    if (!sessionReady || !storageKey || startedAt === null) return;
    writeStoredSession(storageKey, {
      startedAt,
      messages: messages.slice(-100),
    });
  }, [messages, startedAt, sessionReady, storageKey]);

  const resetSession = useCallback(() => {
    setMessages([{ id: 0, role: "assistant", text: GREETING }]);
    setPending(null);
    setTyping(false);
    nextMessageId.current = 1;
    if (storageKey) clearStoredSession(storageKey);
    // An open sheet begins its new hour immediately; a closed one waits for the
    // next open (the effect above), so a reset never burns time unseen.
    setStartedAt(open ? Date.now() : null);
  }, [storageKey, open]);

  // Reset exactly when the hour is up, whether the sheet is open or closed.
  useEffect(() => {
    if (!sessionReady || startedAt === null) return;
    const remaining = startedAt + CHAT_SESSION_MS - Date.now();
    if (remaining <= 0) {
      resetSession();
      return;
    }
    const timer = setTimeout(resetSession, remaining);
    return () => clearTimeout(timer);
  }, [startedAt, sessionReady, resetSession]);

  // No request from a visitor who never opens the assistant.
  const indexKey =
    (open || warm) && clientId
      ? `/api/clients/${clientId}/portal/assistant?forPortal=1`
      : null;
  const {
    data: indexData,
    error: indexError,
    isLoading: indexLoading,
  } = useSWR<AssistantIndexPayload>(indexKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  /** Everything the assistant needs to know about this plan, read once per render. */
  const plan = useMemo<AssistantPlan>(() => {
    const contact = contactChannels(clientData?.keyContacts);
    return {
      clientId,
      companyName: clientData?.companyName,
      advisorName: profile?.name,
      loginUrl: clientData?.insuranceLoginUrl,
      appointmentUrl: clientData?.appointmentLink,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      hubs: buildAssistantHubs({
        clientId,
        benefitHubs: clientData?.benefitHubs,
        categoryPortalVisibility: clientData?.categoryPortalVisibility,
        employeeResourcesEnabled: clientData?.employeeResourcesEnabled === true,
      }),
    };
  }, [clientData, profile, clientId]);

  // The library is always in the bundle; the plan's placements only refine it.
  const corpus = useMemo<AssistantIndex>(() => {
    const placed = indexData?.topics;
    const hidden = indexData?.hiddenSlugs;
    return buildAssistantCorpus({
      placed: Array.isArray(placed) ? placed : [],
      hiddenSlugs: Array.isArray(hidden) ? hidden : [],
      customHubTitle: customBenefitTitleFromHubs(clientData?.benefitHubs),
    });
  }, [indexData, clientData?.benefitHubs]);

  // Focus the composer when the sheet opens, so typing works immediately.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);

  /**
   * Keep the visitor's own question in view, not the end of the answer.
   *
   * A chat transcript normally jumps to its bottom, which lands a long answer on its
   * closing links and hides the question it belongs to. Instead the newest question is
   * pinned near the top of the transcript and the answer unfolds beneath it, so it is
   * read from its first line — whether the question was typed here or handed over by
   * the landing page's Ask bar. With the greeting alone on screen, the sheet stays at
   * the top.
   *
   * The transcript is `relative`, so each row's `offsetTop` is its position in the
   * scrolled content; it is layout-only, untouched by scrolling and by the sheet's
   * open animation.
   */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const lastQuestion = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const anchor = lastQuestion
      ? list.querySelector<HTMLElement>(
          `[data-message-id="${lastQuestion.id}"]`,
        )
      : null;
    if (!anchor) {
      list.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    list.scrollTo({
      top: Math.max(0, anchor.offsetTop - SCROLL_QUESTION_GAP),
      behavior: "smooth",
    });
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

  /**
   * Answer the queued turn once the plan index has arrived (or failed), after a
   * short pause so the reply does not snap in before the visitor has read their own
   * message.
   */
  useEffect(() => {
    if (!pending) return;
    if (indexLoading && !indexData && !indexError) return;

    const timer = setTimeout(() => {
      const reply = pending.topic
        ? respondToTopic({
            slug: pending.topic.slug,
            location: pending.topic.location,
            index: corpus,
            plan,
          })
        : pending.hub
          ? respondToHub({ location: pending.hub, index: corpus, plan })
          : respondToQuestion({
              question: pending.question,
              index: corpus,
              plan,
            });
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId.current++, role: "assistant", reply },
      ]);
      setPending(null);
      setTyping(false);
    }, 220);

    return () => clearTimeout(timer);
  }, [pending, indexLoading, indexData, indexError, corpus, plan]);

  const ask = (
    question: string,
    hub?: TopicLocation,
    topic?: { slug: string; location: TopicLocation },
  ) => {
    const text = question.trim();
    if (!text || typing) return;
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId.current++, role: "user", text },
    ]);
    setDraft("");
    setPending({
      question: text,
      ...(hub ? { hub } : {}),
      ...(topic ? { topic } : {}),
    });
    setTyping(true);
  };

  const send = (override?: string) => ask(override ?? draft);
  const askHub = (hub: AssistantHub) => ask(hub.label, hub.location);
  const askSuggestion = (option: AssistantSuggestion) =>
    ask(
      option.query,
      undefined,
      option.topicSlug && option.location
        ? { slug: option.topicSlug, location: option.location }
        : undefined,
    );

  /**
   * The landing page's Ask bar hands a question over as a window event. Opening the
   * sheet and asking here reuses the whole grounded pipeline — the plan's placements,
   * the answer's CTA and its deep link.
   */
  const askRef = useRef<(question: string) => void>(() => {});
  askRef.current = (question: string) => ask(question);

  useEffect(() => {
    const onExternalAsk = (event: Event) => {
      const detail = (event as CustomEvent<{ question?: unknown }>).detail;
      const question =
        typeof detail?.question === "string" ? detail.question.trim() : "";
      if (!question) return;
      setOpen(true);
      askRef.current(question);
    };
    window.addEventListener(ASSISTANT_ASK_EVENT, onExternalAsk);
    return () => window.removeEventListener(ASSISTANT_ASK_EVENT, onExternalAsk);
  }, []);

  // Sit clear of an open Comments / Messages rail, which occupies the right-hand
  // column and sets these variables on the portal root.
  const edgeStyle: React.CSSProperties = {
    right:
      "max(1.25rem, calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.25rem))",
  };
  // Phones get a full-screen sheet; from `md` up it is the floating card again.
  const isDesktop = useMediaQuery("(min-width: 768px)", false);

  // A fullscreen phone sheet owns the screen. Lock the page behind it so a swipe
  // scrolls the transcript, not the portal, and the page scrollbar disappears.
  // `position: fixed` (with the page's offset preserved) is the only lock iOS Safari
  // honours; `overflow: hidden` alone still lets the page move under a touch.
  useEffect(() => {
    if (!open || isDesktop) return;

    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const scrollY = window.scrollY;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      if (scrollY) window.scrollTo(0, scrollY);
    };
  }, [open, isDesktop]);

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
            // Fullscreen on a phone: the whole viewport, safe areas included, with
            // no card chrome. From `md` up it is the floating card that sits clear of
            // the comments rail and the mobile install bar.
            className="fixed inset-0 z-[60] flex h-full w-full flex-col overflow-hidden bg-white md:bottom-[5.5rem] md:left-auto md:right-auto md:top-auto md:h-[min(32rem,70vh)] md:w-[min(24rem,calc(100vw-2.5rem))] md:rounded-2xl md:border md:border-black/10 md:shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
            style={isDesktop ? edgeStyle : undefined}
          >
            {/* Header — the portal's brand colour, like its other chrome. */}
            <div
              className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top,0px))]"
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
              aria-live="polite"
              aria-relevant="additions text"
              className="relative flex-1 space-y-3 overflow-y-auto overscroll-contain bg-neutral-50 px-4 py-4"
            >
              {messages.map((message) => {
                const isUser = message.role === "user";
                const reply = message.reply;
                return (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    data-message-role={message.role}
                    className={isUser ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        isUser
                          ? "flex max-w-[85%] flex-col items-end gap-1.5"
                          : "flex max-w-[85%] flex-col items-start gap-1.5"
                      }
                    >
                      <p
                        className={
                          isUser
                            ? "rounded-2xl rounded-br-sm px-3.5 py-2 font-red-hat text-[13px] leading-relaxed"
                            : "rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-3.5 py-2 font-red-hat text-[13px] leading-relaxed text-neutral-700"
                        }
                        style={
                          isUser
                            ? {
                                backgroundColor: brandColor,
                                color: readableColor(brandColor),
                              }
                            : undefined
                        }
                      >
                        {isUser ? message.text : (message.text ?? reply?.text)}
                      </p>

                      {/* The plan's published hubs sit under the greeting as
                          conversation starters: pressing one asks the assistant
                          about that benefit, it does not leave the portal. */}
                      {!isUser && message.id === 0 && plan.hubs.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {plan.hubs.map((hub) => (
                            <AssistantChip
                              key={hub.href}
                              label={hub.label}
                              brandColor={brandColor}
                              onClick={() => askHub(hub)}
                            />
                          ))}
                        </div>
                      ) : null}

                      {!isUser && reply ? (
                        <ReplyDetails
                          reply={reply}
                          brandColor={brandColor}
                          plan={plan}
                          onAsk={askSuggestion}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {typing ? (
                <div
                  data-testid="portal-chatbot-typing"
                  className="flex justify-start"
                  aria-label="The benefits assistant is typing"
                >
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-3.5 py-2.5">
                    {[0, 1, 2].map((index) => (
                      <motion.span
                        key={index}
                        className="h-1.5 w-1.5 rounded-full bg-neutral-400"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: index * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Composer */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom,0px))] pt-3"
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
                disabled={!draft.trim() || typing}
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
        onPointerEnter={() => setWarm(true)}
        onFocus={() => setWarm(true)}
        // Distinct from the header's close button, so the two never share an
        // accessible name.
        aria-label={open ? "Close chat" : "Ask a question"}
        aria-expanded={open}
        aria-controls="portal-chatbot"
        // Mobile sits above the install prompt via `--portal-install-inset`; when the
        // prompt is dismissed the variable is 0 and the pill drops to 1.5rem.
        // Desktop uses the corner and ignores the variable. While the fullscreen
        // phone sheet is open the pill is hidden — the header's X closes it.
        className={`fixed bottom-[calc(1.5rem_+_var(--portal-install-inset,0px))] z-[60] h-14 items-center justify-center gap-2 rounded-full text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)] transition-transform hover:scale-105 print:hidden md:bottom-6 ${
          open ? "hidden w-14 md:flex" : "flex px-5"
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

/**
 * One reply, rendered from its shape: the answer's steps and note, suggestion chips,
 * related topics, and the links (CTA → deep link → hub → contact).
 *
 * Nothing inside the sheet closes it: a chip asks another question, and a link opens
 * its destination (in place or in a new tab) while the conversation stays on screen.
 * Only the header's X and the FAB close the assistant.
 */
function ReplyDetails({
  reply,
  brandColor,
  plan,
  onAsk,
}: {
  reply: AssistantReply;
  brandColor: string;
  plan: AssistantPlan;
  onAsk: (option: AssistantSuggestion) => void;
}) {
  return (
    <div className="space-y-2">
      {reply.kind === "answer" && reply.steps.length > 0 ? (
        <ol className="list-decimal space-y-0.5 pl-4 font-red-hat text-[12px] leading-relaxed text-neutral-600">
          {reply.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      {reply.kind === "answer" && reply.note ? (
        <p className="font-red-hat text-[11px] leading-relaxed text-neutral-500">
          {reply.note}
        </p>
      ) : null}

      {reply.kind === "suggest" && reply.options.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {reply.options.map((option) => (
            <AssistantChip
              key={`${option.location ?? ""}:${option.topicSlug ?? option.query}`}
              label={option.label}
              brandColor={brandColor}
              onClick={() => onAsk(option)}
            />
          ))}
        </div>
      ) : null}

      {reply.kind === "answer" && reply.related.length > 0 ? (
        <div className="space-y-1">
          <p className="font-red-hat text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Related
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reply.related.map((related) => (
              <ChatLink
                key={`${related.label}-${related.href}`}
                link={{ label: related.label, href: related.href }}
                brandColor={brandColor}
                plan={plan}
              />
            ))}
          </div>
        </div>
      ) : null}

      {reply.links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {reply.links.map((link) => (
            <ChatLink
              key={`${link.label}-${link.href}`}
              link={link}
              brandColor={brandColor}
              plan={plan}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The shared face of every control inside the sheet: a white pill with the plan's
 * colour on its border and text, so the controls stay quiet next to the filled
 * send button while still belonging to this plan's palette.
 */
function assistantChipStyle(brandColor: string): React.CSSProperties {
  return {
    backgroundColor: "#ffffff",
    borderColor: brandColor,
    color: brandColor,
  };
}

/**
 * A button inside the sheet. The same tint as the portal header's active link, and
 * deliberately a button: pressing it asks a question, it never navigates.
 */
function AssistantChip({
  label,
  onClick,
  brandColor,
}: {
  label: string;
  onClick: () => void;
  brandColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-left font-red-hat text-[12px] font-medium transition-opacity hover:opacity-90"
      style={assistantChipStyle(brandColor)}
    >
      {label}
    </button>
  );
}

/** Where a link takes the reader, in words — in-portal page or external site. */
function destinationHint(link: AssistantLink, plan: AssistantPlan): string {
  const href = link.href;
  if (href.startsWith("mailto:")) return "Opens your email app";
  if (href.startsWith("tel:")) return "Starts a phone call";

  if (/^https?:\/\//i.test(href)) {
    let host = "";
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    return host ? `Opens ${host} in a new tab` : "Opens a new tab";
  }

  if (href.startsWith("#")) return "Stays on this page";

  const [path] = href.split("#");
  const hub = plan.hubs.find(
    (candidate) =>
      path === candidate.href || path.startsWith(`${candidate.href}/`),
  );
  if (hub) {
    return href.includes("#")
      ? `Goes to your ${hub.label} page and opens this answer`
      : `Goes to your ${hub.label} page`;
  }
  if (path.endsWith("/news-events")) return "Goes to the News & Events page";
  if (path.endsWith("/my-benefits-team")) {
    return "Goes to your benefits team page";
  }
  if (path === `/${plan.clientId}` || path === `/${plan.clientId}/`) {
    return "Goes to the portal home page";
  }
  return "Goes to another page in the portal";
}

/**
 * A reply link. In-portal paths go through `next/link`; anything absolute (a
 * recordkeeper, a booking page, `mailto:` / `tel:`) opens outside the portal. Each
 * link spells out where it goes, so a pill is never a surprise. The sheet is left open
 * either way — a participant reading an answer should not lose the conversation
 * because they followed one of its links.
 */
function ChatLink({
  link,
  brandColor,
  plan,
}: {
  link: AssistantLink;
  brandColor: string;
  plan: AssistantPlan;
}) {
  const external =
    link.external === true || /^(https?:|mailto:|tel:)/i.test(link.href);
  const className =
    "inline-flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-1 font-red-hat text-[12px] font-medium transition-opacity hover:opacity-90";
  const style = assistantChipStyle(brandColor);
  const content = (
    <>
      <span>{link.label}</span>
      <span className="text-[10px] font-normal opacity-70">
        {destinationHint(link, plan)}
      </span>
    </>
  );

  if (external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className} style={style}>
      {content}
    </Link>
  );
}
