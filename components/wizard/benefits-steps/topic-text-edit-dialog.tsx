"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

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
  MAX_TOPIC_STEPS,
  topicTextValuesOf,
  type TopicTextValues,
} from "@/lib/topics/text-overrides";
import type { EffectiveTopic } from "@/types/topic";

/**
 * "Edit card text" — one topic's title, short card line, expanded answer and its
 * ordered how-to steps (at most {@link MAX_TOPIC_STEPS}).
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
  onPreview,
}: {
  /** The topic being edited, or null while closed. */
  topic: EffectiveTopic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TopicTextValues) => void | Promise<void>;
  /**
   * Live preview: called with the current field values as the advisor edits, so the
   * page beside the panel reflects an added/removed step (or any text change) before
   * anything is saved. Closing without saving calls it once more with the original
   * values to revert.
   */
  onPreview?: (values: TopicTextValues) => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** The first render after opening only seeds the fields — never a preview. */
  const previewArmedRef = useRef(false);
  /** Set once a save has run, so closing it does NOT revert the preview. */
  const committedRef = useRef(false);
  /** Latest `onPreview`, read from the effect without making it a dependency. */
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  // Load the card's current copy each time the dialog opens (or the topic changes).
  useEffect(() => {
    if (!open || !topic) return;
    const initial = topicTextValuesOf(topic);
    setTitle(initial.title);
    setSummary(initial.summary);
    setAnswer(initial.answer);
    setSteps(initial.steps);
    setSaving(false);
    previewArmedRef.current = false;
    committedRef.current = false;
  }, [open, topic?.topicId]);

  // Push each edit to the live preview. The first pass after the seed is skipped.
  // `onPreview` is read from a ref so a new callback identity each render cannot
  // retrigger this effect (which would loop through the board-cache write).
  useEffect(() => {
    if (!open || !topic || !onPreviewRef.current) return;
    if (!previewArmedRef.current) {
      previewArmedRef.current = true;
      return;
    }
    onPreviewRef.current({ title, summary, answer, steps });
  }, [open, topic?.topicId, title, summary, answer, steps]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !committedRef.current && topic && onPreview) {
      // Closing without saving: put the page back the way it was.
      onPreview(topicTextValuesOf(topic));
    }
    committedRef.current = false;
    onOpenChange(next);
  };

  const canAddStep = steps.length < MAX_TOPIC_STEPS;

  const updateStep = (index: number, value: string) =>
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? value : step)),
    );

  const removeStep = (index: number) =>
    setSteps((current) => current.filter((_step, stepIndex) => stepIndex !== index));

  const addStep = () => {
    if (!canAddStep) return;
    setSteps((current) => [...current, ""]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title, summary, answer, steps });
      // The saved values now ARE the page, so closing must not revert them.
      committedRef.current = true;
      handleOpenChange(false);
    } catch {
      // The host surfaces the error; keep the dialog open so the edit is not lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
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
              className="min-h-[110px] leading-relaxed"
            />
          </div>

          {/* Steps — the numbered how-to under the answer. At most four. */}
          <div className="space-y-2 rounded-lg border border-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-bold">Steps</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {steps.length}/{MAX_TOPIC_STEPS}
              </span>
            </div>

            {steps.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No steps yet. Add up to {MAX_TOPIC_STEPS} numbered steps.
              </p>
            )}

            <div className="space-y-1.5">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right font-dm-serif text-[13px] font-semibold tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Input
                    value={step}
                    onChange={(event) => updateStep(index, event.target.value)}
                    aria-label={`Step ${index + 1}`}
                    placeholder={`Step ${index + 1}`}
                    className="h-9"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    aria-label={`Remove step ${index + 1}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStep}
              disabled={!canAddStep}
              className="text-[11px]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add step
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-label="Saving"
                role="status"
              />
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
