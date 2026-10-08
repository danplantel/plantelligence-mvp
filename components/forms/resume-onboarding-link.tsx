"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Self-serve "email me a link to continue setup".
 *
 * For a user who started onboarding but left before finishing (and lost the
 * browser/session state), this re-sends the resume email. The endpoint is
 * intentionally opaque — it always succeeds, so this component shows a neutral
 * message rather than confirming whether the address exists or is unfinished.
 */
export function ResumeOnboardingLink({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await fetch("/api/onboarding-wizard/request-resume-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Best-effort; the response is deliberately opaque, so there is nothing
      // to distinguish here.
    } finally {
      setIsSubmitting(false);
      setSent(true);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          // Reset for the next open.
          setSent(false);
          setEmail("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-sm underline text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
        >
          Already started setup? Email me a link to continue
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Continue your setup</DialogTitle>
          <DialogDescription>
            {
              "Enter the email you signed up with and we'll send a link to pick up where you left off. You'll sign in to open it."
            }
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <p className="text-sm text-muted-foreground">
            {"If there's an unfinished setup for "}
            <strong className="text-foreground">{email}</strong>
            {", a resume link is on its way. Check your inbox and spam folder."}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="resume-email">Email</Label>
              <Input
                id="resume-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                loadingText="Sending…"
              >
                Email me a link
              </LoadingButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
