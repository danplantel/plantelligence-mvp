"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  topicTextValuesOf,
  type TopicTextValues,
} from "@/lib/topics/text-overrides";
import type { EffectiveTopic } from "@/types/topic";

/**
 * "Edit card text" — one topic's title, short card line and expanded answer.
 *
 * Shared by BOTH card lists in the Editing Panel: a Featured card (the Card Layout's
 * rows) and a Quick Answers question (the builder's rows) open the same dialog, because
 * they edit the same placement board. The host turns the returned values into the
 * plan-scoped overrides and writes them; this dialog only collects them.
 *
 * Fields start from the card's CURRENT copy, so an advisor edits from what a
 * participant sees. Clearing a field hands back an empty string; the host writes it as
 * "remove the override" (fall back to the shipped copy).
 */
export function TopicTextEditDialog({
  topic,
  open,
  onOpenChange,
  onSave,
}: {
  /** The topic being edited, or null while closed. */
  topic: EffectiveTopic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TopicTextValues) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  // Load the card's current copy each time the dialog opens (or the topic changes).
  useEffect(() => {
    if (!open || !topic) return;
    const initial = topicTextValuesOf(topic);
    setTitle(initial.title);
    setSummary(initial.summary);
    setAnswer(initial.answer);
    setSaving(false);
  }, [open, topic?.topicId]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title, summary, answer });
      onOpenChange(false);
    } catch {
      // The host surfaces the error; keep the dialog open so the edit is not lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The portal's Editing Panel is `fixed z-[51]`, so the dialog has to sit
          above it (the same tier the other panel dialogs use). */}
      <DialogContent overlayClassName="z-[110]" className="z-[110] max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit card text</DialogTitle>
          <DialogDescription>
            Applies to this plan only. Clear a field to go back to the standard
            copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="topic-text-title" className="text-xs font-bold">
              Title
            </Label>
            <Input
              id="topic-text-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Card title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-text-summary" className="text-xs font-bold">
              Card line
            </Label>
            <Input
              id="topic-text-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Short line shown on the card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-text-answer" className="text-xs font-bold">
              Answer
            </Label>
            <Textarea
              id="topic-text-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="The expanded answer participants read"
              className="min-h-[130px] leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
