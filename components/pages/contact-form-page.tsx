"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import { cn } from "@/lib/utils";
import { Loader2, Send, CheckCircle2, AlertCircle, Building2, User } from "lucide-react";
import { motion } from "framer-motion";
import { OTHER_TOPIC_LABEL } from "@/lib/contact-form-topics";

interface ContactFormPageProps {
  /** Recipient email (the contact/advisor the message goes to). */
  to?: string;
  /** Optional company/plan name for context. */
  company?: string;
  /** Optional pre-filled contact/advisor name. */
  contactName?: string;
  /** Optional contact title/role (e.g. "HR Director"). */
  contactTitle?: string;
  /** Optional headshot/photo of the contact receiving the message. */
  avatar?: string;
  /** Optional company/plan logo to show with the company name. */
  companyLogo?: string;
  /** Render compact for embedding in a modal/preview (no full-viewport height). */
  embedded?: boolean;
  /** Disable real submission — for previewing the form inside the editor. */
  preview?: boolean;
  /**
   * Advisor-configured "Topic of Interest" choices for this contact's benefits
   * category, in the order the advisor arranged them. Only the active topics
   * are passed here. When omitted/empty no topic section is rendered.
   */
  topics?: string[];
  /**
   * Benefits category of the contact (e.g. "Retirement"). Shown under the
   * contact's name/company at the top of the page and used in the topics
   * heading. Hidden when empty.
   */
  category?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Reasonable cap for a contact-form message (matches the API's 5000-char limit). */
const MESSAGE_MAX_LENGTH = 1000;
/** Cap for the free-text "Other" topic details. */
const OTHER_TOPIC_MAX_LENGTH = 200;
const OTHER_TOPIC_LOWER = OTHER_TOPIC_LABEL.toLowerCase();

export function ContactFormPage({
  to = "",
  company = "",
  contactName = "",
  contactTitle = "",
  avatar = "",
  companyLogo = "",
  embedded = false,
  preview = false,
  topics,
  category = "",
}: ContactFormPageProps) {
  // Defensive normalization: these values arrive from URL params and editor
  // state, so trim them (and collapse stray internal whitespace) before they are
  // rendered — otherwise a trailing space shows up around the name in the header.
  const cleanContactName = contactName.trim().replace(/\s+/g, " ");
  const cleanContactTitle = contactTitle.trim().replace(/\s+/g, " ");
  const cleanCompany = company.trim().replace(/\s+/g, " ");
  const cleanCategory = category.trim();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  /** Topics the participant selected (ordered as they appear in the list). */
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  /** Free-text details captured when the participant picks "Other". */
  const [otherTopicDetail, setOtherTopicDetail] = useState("");

  // Only the advisor-active topics reach the participant, de-duplicated and
  // trimmed in the advisor-defined order — except "Other", which is always
  // pinned to the bottom of the list regardless of how the advisor ordered it.
  const topicOptions = (() => {
    const deduped = Array.from(
      new Set(
        (topics || [])
          .map((t) => (t || "").trim())
          .filter((t) => t.length > 0),
      ),
    );
    const other = deduped.filter((t) => t.toLowerCase() === OTHER_TOPIC_LOWER);
    const rest = deduped.filter((t) => t.toLowerCase() !== OTHER_TOPIC_LOWER);
    return [...rest, ...other];
  })();
  const otherTopicSelected = selectedTopics.some(
    (t) => t.toLowerCase() === OTHER_TOPIC_LOWER,
  );

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.some((t) => t.toLowerCase() === topic.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== topic.toLowerCase())
        : [...prev, topic],
    );
  };

  /** Selected topics in list order, with the "Other" detail folded in. */
  const buildSubmittedTopics = (): string[] =>
    topicOptions
      .filter((t) =>
        selectedTopics.some((s) => s.toLowerCase() === t.toLowerCase()),
      )
      .map((t) =>
        t.toLowerCase() === OTHER_TOPIC_LOWER && otherTopicDetail.trim()
          ? `${t}: ${otherTopicDetail.trim().slice(0, OTHER_TOPIC_MAX_LENGTH)}`
          : t,
      );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string | null> = {};
    if (!name.trim()) errs.name = "Please enter your name.";
    if (!email.trim() || !EMAIL_RE.test(email.trim())) errs.email = "Please enter a valid email address.";
    if (!message.trim()) errs.message = "Please enter a message.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Preview mode (inside the editor) must never send a real email.
    if (preview) return;

    setIsSubmitting(true);
    try {
      const submittedTopics = buildSubmittedTopics();
      const res = await fetch("/api/contact-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          fromName: name.trim(),
          fromEmail: email.trim(),
          message: message.trim(),
          company: cleanCompany || undefined,
          topics: submittedTopics.length ? submittedTopics : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "There was a problem sending your message. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("There was a problem sending your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Forced-light contact page: white background with a light-gray form wrapper,
    // regardless of the surrounding app theme. `dark:` overrides mirror the light
    // palette so the page always looks the same for employees.
    <div className={`${embedded ? "" : "min-h-screen "}bg-white text-gray-900`}>
      <div
        className={`mx-auto w-full max-w-xl px-4 ${
          embedded ? "py-6 sm:py-8" : "py-12 sm:py-16"
        }`}
      >
        {/* Header / brand */}
        <motion.div
          className="flex flex-col items-center text-center mb-8"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <img
            src="/plantelligence-logos/pt_web_light.png"
            alt="Plantelligence"
            className="h-8 w-auto mb-6 rounded-lg"
          />
          {/* <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-900 font-dm-serif">
            Contact Us
          </h1> */}
          {companyLogo && (
            <div className="flex items-center justify-center">
              <BrandingImage
                src={companyLogo}
                alt={cleanCompany || "Company logo"}
                className="h-12 w-auto max-w-[200px] object-contain"
              />
            </div>
          )}
          {avatar && (
            <div className="my-2 w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-200 bg-white shadow-md flex-shrink-0">
              <Headshot
                src={avatar}
                alt={cleanContactName || "Contact"}
                monogramName={cleanContactName}
              />
            </div>
          )}
          {cleanCompany && cleanContactName && cleanContactTitle && (
            <p className="text-sm text-gray-600 dark:text-gray-600 mt-2 flex items-center gap-1.5">
              <span className="font-semibold">{cleanContactName}</span>
              {`, ${cleanContactTitle} at ${cleanCompany}`}
            </p>
          )}
          {cleanCategory && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-200 bg-gray-100 dark:bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-600">
              <Building2 className="w-3.5 h-3.5" />
              {cleanCategory}
            </p>
          )}
        </motion.div>

        {/* Form wrapper — light gray to complement the white page */}
        <motion.div
          className="bg-gray-100 dark:bg-gray-100 rounded-2xl border border-gray-200 dark:border-gray-200 shadow-sm p-6 sm:p-8"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: "easeOut" }}
        >
          {sent ? (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-900">Message sent!</h2>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Thank you{name ? `, ${name.trim().split(" ")[0]}` : ""}. Your message has been sent
                and you can expect a reply shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="cf-name" className="text-sm font-medium text-gray-700 dark:text-gray-700">
                  Your Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Smith"
                  className="h-10 border-gray-300 dark:border-gray-300 bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder:text-gray-400"
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-500">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cf-email" className="text-sm font-medium text-gray-700 dark:text-gray-700">
                  Your Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jordan@company.com"
                  className="h-10 border-gray-300 dark:border-gray-300 bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder:text-gray-400"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500">{fieldErrors.email}</p>
                )}
              </div>

              {topicOptions.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-700">
                      Topic of Interest
                    </Label>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      {cleanCategory
                        ? `What would you like help with? Select any that apply to ${cleanCategory}.`
                        : "What would you like help with? Select any that apply."}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {topicOptions.map((topic) => {
                      const id = `cf-topic-${topic
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "")}`;
                      return (
                        <div
                          key={topic}
                          className="flex items-start gap-2.5 rounded-lg border border-gray-300 dark:border-gray-300 bg-white dark:bg-white px-3 py-2 transition-colors hover:border-accent-blue/50 hover:bg-accent-blue/5 dark:hover:bg-accent-blue/5"
                        >
                          <Checkbox
                            id={id}
                            checked={selectedTopics.some(
                              (t) => t.toLowerCase() === topic.toLowerCase(),
                            )}
                            onCheckedChange={() => toggleTopic(topic)}
                            className="mt-0.5 border-gray-400 dark:border-gray-400 data-[state=checked]:bg-accent-blue data-[state=checked]:border-accent-blue"
                          />
                          <Label
                            htmlFor={id}
                            className="flex-1 text-sm font-normal text-gray-800 dark:text-gray-800 leading-snug cursor-pointer"
                          >
                            {topic}
                          </Label>
                        </div>
                      );
                    })}
                  </div>

                  {otherTopicSelected && (
                    <div className="space-y-1 pl-1">
                      <Label
                        htmlFor="cf-topic-other"
                        className="text-xs font-medium text-gray-700 dark:text-gray-700"
                      >
                        Please tell us more (optional)
                      </Label>
                      <Input
                        id="cf-topic-other"
                        value={otherTopicDetail}
                        onChange={(e) =>
                          setOtherTopicDetail(
                            e.target.value.slice(0, OTHER_TOPIC_MAX_LENGTH),
                          )
                        }
                        placeholder="Briefly describe what you need help with"
                        className="h-10 border-gray-300 dark:border-gray-300 bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="cf-message" className="text-sm font-medium text-gray-700 dark:text-gray-700">
                    Message <span className="text-red-500">*</span>
                  </Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      message.length >= MESSAGE_MAX_LENGTH
                        ? "text-red-500"
                        : "text-gray-400 dark:text-gray-400",
                    )}
                    aria-live="polite"
                  >
                    {message.length}/{MESSAGE_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="cf-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                  rows={10}
                  maxLength={MESSAGE_MAX_LENGTH}
                  placeholder="How can we help you?"
                  className="flex w-full rounded-lg border border-gray-300 dark:border-gray-300 bg-white dark:bg-white text-gray-900 dark:text-gray-900 placeholder:text-gray-400 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue/40 focus-visible:border-accent-blue disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
                {fieldErrors.message && (
                  <p className="text-xs text-red-500">{fieldErrors.message}</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {preview && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-700">
                  Preview only — messages are not sent from this preview.
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || preview}
                className="w-full bg-accent-blue hover:bg-accent-blue/90 text-white disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-gray-500 dark:text-gray-500">
                Powered by PlanTelligence®
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
