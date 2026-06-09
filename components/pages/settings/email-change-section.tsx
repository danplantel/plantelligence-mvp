"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Check,
  Loader2,
  Shield,
  Pencil,
  X,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface EmailChangeSectionProps {
  currentEmail: string;
  onEmailChanged: (newEmail: string) => void;
}

type Stage = "view" | "enter-new" | "verify" | "success";

export function EmailChangeSection({
  currentEmail,
  onEmailChanged,
}: EmailChangeSectionProps) {
  const [stage, setStage] = useState<Stage>("view");
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartChange = () => {
    setNewEmail("");
    setVerificationCode("");
    setError(null);
    setStage("enter-new");
  };

  const handleCancel = () => {
    setNewEmail("");
    setVerificationCode("");
    setError(null);
    setStage("view");
  };

  const handleSendCode = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/send-email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      // If email delivery failed (e.g. SMTP unavailable), stay on this stage
      // so the user can retry. The code is stored in the DB and "Resend"
      // will work once SMTP is available.
      if (data.emailSent === false) {
        setError(
          data.message ||
            "Email delivery failed. The code was stored — you can retry with 'Resend code' once email is available."
        );
        return;
      }

      setMaskedEmail(data.maskedEmail || currentEmail);
      setStage("verify");
      toast.success("Verification code sent to your current email");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/verify-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      onEmailChanged(data.newEmail);
      setStage("success");
      toast.success("Email changed successfully!");
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/send-email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to resend code");
      }

      toast.success("New code sent!");
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setIsSending(false);
    }
  };

  // ── Stage: View ──────────────────────────────────────────────────────────
  if (stage === "view") {
    return (
      <div className="space-y-2">
        <label className="block font-medium text-sm">Your Email</label>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm flex-1 truncate">{currentEmail}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartChange}
            className="flex-shrink-0 gap-1.5 text-xs h-8 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Pencil className="h-3.5 w-3.5" />
            Change Email
          </Button>
        </div>
      </div>
    );
  }

  // ── Stage: Enter New Email ───────────────────────────────────────────────
  if (stage === "enter-new") {
    return (
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Email <span className="text-red-500">*</span>
        </label>
        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-3">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Email Change Verification Required
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                For security, a 6-digit verification code will be sent to your
                current email address ({currentEmail}) before the change takes
                effect.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setError(null);
              }}
              placeholder="Enter new email address"
              icon={<Mail className="h-4 w-4" />}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleSendCode}
              disabled={isSending || !newEmail}
              className="gap-1.5 flex-shrink-0 bg-accent-blue hover:bg-accent-blue/90"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isSending ? "Sending..." : "Send Code"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    );
  }

  // ── Stage: Verify Code ───────────────────────────────────────────────────
  if (stage === "verify") {
    return (
      <div className="space-y-2">
        <label className="block font-medium text-sm">
          Your Email <span className="text-red-500">*</span>
        </label>
        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 space-y-3">
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                Verify Your New Email
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5">
                A 6-digit code was sent to{" "}
                <span className="font-medium">{maskedEmail}</span>. Enter it below
                to confirm changing to{" "}
                <span className="font-medium">{newEmail}</span>.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setVerificationCode(val);
                setError(null);
              }}
              placeholder="000000"
              className="flex-1 text-center text-lg tracking-[0.3em] font-mono"
            />
            <Button
              type="button"
              onClick={handleVerifyCode}
              disabled={isVerifying || verificationCode.length !== 6}
              className="gap-1.5 flex-shrink-0 bg-accent-blue hover:bg-accent-blue/90"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isSending}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {isSending ? "Resending..." : "Resend code"}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    );
  }

  // ── Stage: Success ───────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <label className="block font-medium text-sm">Your Email</label>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-sm flex-1 truncate text-green-700 dark:text-green-400">
          {newEmail}
        </span>
        <span className="text-xs text-green-600 dark:text-green-500 flex-shrink-0 font-medium">
          Updated
        </span>
      </div>
    </div>
  );
}
