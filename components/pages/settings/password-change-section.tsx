"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Check,
  Loader2,
  Shield,
  Pencil,
  X,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

type Stage = "view" | "enter" | "verify" | "success";

export function PasswordChangeSection() {
  const [stage, setStage] = useState<Stage>("view");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleStartChange = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setError(null);
    setStage("enter");
  };

  const handleCancel = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setError(null);
    setStage("view");
  };

  const handleSendCode = async () => {
    // Validate password fields
    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/send-password-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      if (data.emailSent === false) {
        setError(
          data.message ||
            "Email delivery failed. You can retry after configuring email."
        );
        return;
      }

      setMaskedEmail(data.maskedEmail || "");
      setStage("verify");
      toast.success("Verification code sent to your email");
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
      const res = await fetch("/api/profile/verify-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          code: verificationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setStage("success");
      toast.success("Password changed successfully!");
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
      const res = await fetch("/api/profile/send-password-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (stage === "enter") {
        handleSendCode();
      } else if (stage === "verify") {
        handleVerifyCode();
      }
    }
  };

  // ── Stage: View ──────────────────────────────────────────────────────────
  if (stage === "view") {
    return (
      <div className="space-y-2">
        <label className="block font-medium text-sm">Password</label>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm flex-1 text-muted-foreground">••••••••</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartChange}
            className="flex-shrink-0 gap-1.5 text-xs h-8 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Pencil className="h-3.5 w-3.5" />
            Change Password
          </Button>
        </div>
      </div>
    );
  }

  // ── Stage: Enter New Password ────────────────────────────────────────────
  if (stage === "enter") {
    return (
      <div className="space-y-2">
        <label className="block font-medium text-sm">Password</label>
        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-3">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Change Your Password
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Enter your current password and a new password. A verification code
                will be sent to your email before the change takes effect.
              </p>
            </div>
          </div>

          {/* Current Password */}
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Current password"
              icon={<Lock className="h-4 w-4" />}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* New Password */}
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="New password (min. 8 characters)"
              icon={<Lock className="h-4 w-4" />}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Confirm New Password */}
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Confirm new password"
              icon={<Lock className="h-4 w-4" />}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password requirements hint */}
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Password must be at least 8 characters.
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleSendCode}
              disabled={
                isSending ||
                !currentPassword ||
                !newPassword ||
                newPassword.length < 8 ||
                !confirmPassword
              }
              className="gap-1.5 bg-accent-blue hover:bg-accent-blue/90"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isSending ? "Sending..." : "Send Code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  // ── Stage: Verify Code ───────────────────────────────────────────────────
  if (stage === "verify") {
    return (
      <div className="space-y-2">
        <label className="block font-medium text-sm">Password</label>
        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 space-y-3">
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                Verify Password Change
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5">
                A 6-digit code was sent to{" "}
                <span className="font-medium">{maskedEmail}</span>. Enter it below
                to confirm changing your password.
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
              onKeyDown={handleKeyDown}
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

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  // ── Stage: Success ───────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <label className="block font-medium text-sm">Password</label>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-sm flex-1 text-green-700 dark:text-green-400">
          Password updated
        </span>
        <span className="text-xs text-green-600 dark:text-green-500 flex-shrink-0 font-medium">
          Updated
        </span>
      </div>
    </div>
  );
}
