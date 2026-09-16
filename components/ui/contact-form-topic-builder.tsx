"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Lightbulb,
  Plus,
  Trash2,
} from "lucide-react";
import {
  MAX_CONTACT_FORM_TOPICS,
  MAX_CONTACT_TOPIC_LABEL_LENGTH,
  createContactFormTopic,
  getDefaultContactFormTopics,
  normalizeContactFormTopics,
} from "@/lib/contact-form-topics";
import type { ContactFormTopic } from "@/lib/contact-form-topics";

export interface ContactFormTopicBuilderProps {
  /**
   * Benefits category that drives the suggested topic list. `null`/undefined
   * means "no suggestions" (custom category) — the advisor builds the list.
   */
  category?: string | null;
  /** Current configuration for this contact. */
  topics: ContactFormTopic[];
  /** Receives the next configuration whenever the advisor changes something. */
  onChange: (topics: ContactFormTopic[]) => void;
  className?: string;
}

/**
 * Advisor-facing builder for the participant-facing "Topic of Interest" choices
 * on the PlanTelligence-branded `/contact` form.
 *
 * Suggested topics for the contact's benefits category can be switched on/off,
 * custom topics can be added, any topic can be deleted, and the participant
 * sees exactly the active topics in the order arranged here. "Other" is part of
 * every suggestion set by default.
 */
export function ContactFormTopicBuilder({
  category,
  topics,
  onChange,
  className,
}: ContactFormTopicBuilderProps) {
  const [newTopic, setNewTopic] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const safeTopics = useMemo(
    () => normalizeContactFormTopics(topics),
    [topics],
  );

  // Suggested defaults for this category (labels only).
  const suggestions = useMemo(
    () => getDefaultContactFormTopics(category).map((t) => t.label),
    [category],
  );

  const activeLabels = useMemo(
    () => new Set(safeTopics.map((t) => t.label.toLowerCase())),
    [safeTopics],
  );

  const activeCount = safeTopics.filter(
    (t) => t.enabled && t.label.trim(),
  ).length;

  const commit = (next: ContactFormTopic[]) => onChange(next);

  /** Add a topic (used by both "re-activate suggestion" and "+ Add Topic"). */
  const handleAdd = (label: string) => {
    const clean = label.trim().slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
    if (!clean) return;
    if (safeTopics.some((t) => t.label.toLowerCase() === clean.toLowerCase())) {
      return;
    }
    if (safeTopics.length >= MAX_CONTACT_FORM_TOPICS) return;
    commit([...safeTopics, createContactFormTopic(clean)]);
  };

  const handleRemove = (id: string) => {
    commit(safeTopics.filter((t) => t.id !== id));
  };

  const handleToggle = (id: string, enabled: boolean) => {
    commit(safeTopics.map((t) => (t.id === id ? { ...t, enabled } : t)));
  };

  const handleMove = (from: number, to: number) => {
    if (from === to || to < 0 || to >= safeTopics.length) return;
    const next = [...safeTopics];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="space-y-1">
        <Label className="dark:text-gray-300 text-xs font-medium flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Topics of Interest
        </Label>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
          Participants pick from these choices on the contact form (each choice
          is optional). Activate the suggestions you want, add your own, and
          drag or use the arrows to set the order. Only active topics are shown —
          &ldquo;Other&rdquo; stays available by default.
        </p>
      </div>

      {/* Suggested defaults — checkbox to activate */}
      {suggestions.length > 0 && (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Suggested for {category || "this category"}
          </p>
          <div className="space-y-1">
            {suggestions.map((label) => {
              const isActive = activeLabels.has(label.toLowerCase());
              return (
                <div
                  key={label}
                  className="flex items-start gap-2 px-1 py-0.5"
                >
                  <Checkbox
                    id={`suggested-topic-${label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")}`}
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        handleAdd(label);
                      } else {
                        const match = safeTopics.find(
                          (t) => t.label.toLowerCase() === label.toLowerCase(),
                        );
                        if (match) handleRemove(match.id);
                      }
                    }}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`suggested-topic-${label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")}`}
                    className="text-[11px] leading-snug cursor-pointer dark:text-gray-300"
                  >
                    {label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active topics — ordered list shown to participants */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Active topics
          </p>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
            {activeCount} shown
          </span>
        </div>

        {safeTopics.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1 py-2">
            No topics yet. Activate a suggestion above or add a custom topic.
          </p>
        ) : (
          <div className="space-y-1">
            {safeTopics.map((topic, index) => {
              const isCustomSuggestion = !suggestions.some(
                (s) => s.toLowerCase() === topic.label.toLowerCase(),
              );
              return (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(index);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) handleMove(dragIndex, index);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-white dark:bg-gray-800 px-2 py-1.5 transition-colors",
                    dragOverIndex === index && dragIndex !== null &&
                      dragIndex !== index
                      ? "border-accent-blue bg-accent-blue/5"
                      : "border-gray-200 dark:border-gray-700",
                  )}
                >
                  <GripVertical
                    className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0 cursor-grab"
                    aria-hidden="true"
                  />
                  <Checkbox
                    id={`active-topic-${topic.id}`}
                    checked={topic.enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(topic.id, checked === true)
                    }
                    className="shrink-0"
                  />
                  <Label
                    htmlFor={`active-topic-${topic.id}`}
                    className={cn(
                      "flex-1 text-[11px] leading-snug cursor-pointer truncate",
                      topic.enabled
                        ? "text-gray-700 dark:text-gray-200"
                        : "text-gray-400 dark:text-gray-500 line-through",
                    )}
                    title={topic.label}
                  >
                    {topic.label}
                  </Label>
                  {isCustomSuggestion && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 shrink-0">
                      Custom
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, index - 1)}
                      disabled={index === 0}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Move "${topic.label}" up`}
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, index + 1)}
                      disabled={index === safeTopics.length - 1}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Move "${topic.label}" down`}
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(topic.id)}
                      className="w-5 h-5 rounded flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      aria-label={`Delete "${topic.label}"`}
                      title="Delete topic"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* + Add Topic */}
      <div className="flex items-center gap-2">
        <Input
          value={newTopic}
          onChange={(e) =>
            setNewTopic(e.target.value.slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd(newTopic);
              setNewTopic("");
            }
          }}
          placeholder="Add a custom topic…"
          className="h-8 text-sm flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          disabled={
            !newTopic.trim() || safeTopics.length >= MAX_CONTACT_FORM_TOPICS
          }
          onClick={() => {
            handleAdd(newTopic);
            setNewTopic("");
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Topic
        </Button>
      </div>

      {safeTopics.length >= MAX_CONTACT_FORM_TOPICS && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          Maximum of {MAX_CONTACT_FORM_TOPICS} topics reached.
        </p>
      )}
    </div>
  );
}
