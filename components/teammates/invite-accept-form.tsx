"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  Loader2,
  Lock,
  Mail,
  Phone,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ContactFormTopicBuilder } from "@/components/ui/contact-form-topic-builder";
import { StickyPreviewContainer } from "@/components/ui/sticky-preview-container";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import {
  CONTACT_VISIBILITY_HELPER_TEXT,
  hasReachableMethod,
} from "@/lib/contact-form-copy";
import { buildContactFormHref } from "@/lib/contact-form-link";
import {
  getActiveContactFormTopicLabels,
  type ContactFormTopic,
} from "@/lib/contact-form-topics";
import { inviterFirmLabel } from "@/lib/teammates/invite-copy";
import { cn } from "@/lib/utils";

/**
 * The live preview uses the same card the portal renders. The public invite page
 * has no organization palette loaded (no wizard store, no session), so it previews
 * on the product's own accent rather than the firm's colours — the structure is
 * what the invitee is choosing, not the firm's theme.
 */
const PREVIEW_BRAND_COLOR = "#23919C";
const PREVIEW_SECONDARY_COLOR = "#1B7A83";

interface InvitationView {
  status:
    | "ok"
    | "invalid"
    | "expired"
    | "already_accepted"
    | "deactivated"
    | "revoked";
  email?: string;
  /** What the seat already holds — the form opens filled in from these. */
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  headshot?: string | null;
  inviterName?: string | null;
  organizationName?: string | null;
  /**
   * Card presentation the seat already holds — mirrors the server's
   * `InvitationView`. Prefilled into the form below.
   */
  displayEmail?: boolean;
  displayPhone?: boolean;
  cardContactType?: "individual" | "team_support" | null;
  enableContactButton?: boolean;
  ctaType?: "schedule" | "call" | "email" | "contact" | null;
  schedulingUrl?: string | null;
  websiteUrl?: string | null;
  contactFormTopics?: ContactFormTopic[] | null;
  /** Set only when the invitation covers exactly ONE plan — see the server's `InvitationView`. */
  planName?: string | null;
  sectionName?: string | null;
  /** How many plans are covered today, and whether the seat covers every plan (now and later). */
  planCount?: number;
  allPlans?: boolean;
  personType?: "team_member" | "collaborator";
  accountExists?: boolean;
  landingUrl?: string;
}

/** `(555) 123-4567` as it is typed; the digits are what get stored. */
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/** `["a"]` → `a`; `["a","b"]` → `a and b`; `["a","b","c"]` → `a, b, and c`. */
function formatSentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * T9 — accepting an invitation.
 *
 * Four things this form is careful about:
 *
 *  1. **It shows what is being asked before asking for anything.** An external person who has
 *     never heard of the product should see who invited them, which organization, and which plan
 *     and section — before typing a password.
 *  2. **The email is fixed.** It is displayed, not editable: the invitation is for one mailbox,
 *     and letting the field be changed would let an invite be redeemed by a different account
 *     than the one it was addressed to.
 *  3. **Linking is not access.** Accepting links a login to the profile; it grants the person
 *     nothing until they can actually sign in as that account. That is why an existing account
 *     keeps its own password and is never overwritten here — the security boundary is the
 *     account, not the link.
 *  4. **Accepting is also profile setup.** The fields are the same ones the Key Contact form
 *     collects, laid out the same way (`new-client-steps/…/contact-form-slide.tsx`), because the
 *     person filling them in is the person they describe: the seat holds what the inviting
 *     advisor captured, and this is the one moment where the invitee themself can correct or
 *     complete it instead of waiting to find Settings after they sign in.
 */
export function InviteAcceptForm({ token }: { token: string }) {
  const [view, setView] = useState<InvitationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Profile fields — prefilled from the seat once the invitation resolves.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneExtension, setPhoneExtension] = useState("");
  const [headshot, setHeadshot] = useState("");
  const [headshotFileName, setHeadshotFileName] = useState("");

  // Card presentation — the "Show on contact card" toggles, the card's own type, and
  // the call-to-action group, mirrored from the Key Contact form so an invited
  // teammate finishes their own card instead of waiting for an admin to fill it in.
  const [cardContactType, setCardContactType] = useState<
    "individual" | "team_support"
  >("individual");
  const [displayEmail, setDisplayEmail] = useState(false);
  const [displayPhone, setDisplayPhone] = useState(false);
  const [enableCtaButton, setEnableCtaButton] = useState(false);
  const [ctaType, setCtaType] = useState<
    "schedule" | "call" | "email" | "contact"
  >("schedule");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [contactFormTopics, setContactFormTopics] = useState<ContactFormTopic[]>(
    [],
  );

  // Credentials. Two fields with the same eye toggle the signup form pairs them with, so the
  // value is never typed blind and a typo is caught before the account exists.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const [accepted, setAccepted] = useState<{
    landingUrl: string;
    email: string;
    createdAccount: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/teammates/accept-invite?token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        invitation?: InvitationView;
        status?: InvitationView["status"];
        message?: string;
      };
      const invitation =
        body.invitation ??
        ({ status: body.status ?? "invalid" } as InvitationView);
      setView(invitation);
      setError(invitation.status === "ok" ? null : body.message ?? null);

      // Fill the form from the seat rather than from an empty state: these are the values the
      // advisor already entered when they invited them, and retyping your own name is exactly
      // the duplicate entry the contact picker exists to avoid. The person only adds what is
      // missing — or corrects what is wrong.
      if (invitation.status === "ok") {
        setFirstName(invitation.firstName ?? "");
        setLastName(invitation.lastName ?? "");
        setJobTitle(invitation.jobTitle ?? "");
        setPhone(invitation.phone ?? "");
        setPhoneExtension(invitation.phoneExtension ?? "");
        setHeadshot(invitation.headshot ?? "");
        // Card presentation, restored from the seat exactly like the identity fields.
        setCardContactType(invitation.cardContactType ?? "individual");
        setDisplayEmail(invitation.displayEmail ?? false);
        setDisplayPhone(invitation.displayPhone ?? false);
        setEnableCtaButton(invitation.enableContactButton ?? false);
        setCtaType(invitation.ctaType ?? "schedule");
        setSchedulingUrl(invitation.schedulingUrl ?? "");
        setContactFormTopics(invitation.contactFormTopics ?? []);
      }
    } catch {
      setView({ status: "invalid" });
      setError("Could not load this invitation.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // This is a public page reached from an invitation email, often by someone who has never seen
  // the product — it must read the same for everyone rather than inheriting the advisor's
  // dashboard preference. The dashboard sets a global `.dark` class on <html> via next-themes,
  // which activates every `dark:` utility below. Mirror the portal layout
  // (`app/(portal)/[id]/layout.tsx`) and strip `.dark` while this page is mounted, restoring it on
  // the way out so a signed-in user's own theme is left untouched.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const prevColorScheme = root.style.colorScheme;

    root.classList.remove("dark");
    root.style.colorScheme = "light";

    return () => {
      root.classList.toggle("dark", hadDark);
      root.style.colorScheme = prevColorScheme;
    };
  }, []);

  const creatingAccount = view ? !view.accountExists : false;

  const hasError = (field: string): boolean => {
    if (!validationAttempted) return false;
    switch (field) {
      case "firstName":
        return !firstName.trim();
      case "lastName":
        return !lastName.trim();
      case "phone": {
        const digits = phone.replace(/\D/g, "");
        return digits.length > 0 && digits.length < 10;
      }
      case "password":
        return creatingAccount && password.trim().length < 8;
      case "confirmPassword":
        return creatingAccount && (confirmPassword.length === 0 || !passwordsMatch);
      default:
        return false;
    }
  };

  const submit = async () => {
    if (!view) return;
    setValidationAttempted(true);
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please add your first and last name.");
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a complete phone number.");
      return;
    }
    // The one card rule that is a real inconsistency: a "Schedule Appt." button with
    // no link to schedule on. Visibility is guided but NOT gated — acceptance must
    // stay possible in one step, and the invitee's email is always reachable.
    if (enableCtaButton && ctaType === "schedule" && !schedulingUrl.trim()) {
      setError("Add a scheduling URL for the Schedule Appt. button.");
      return;
    }
    if (creatingAccount) {
      if (password.trim().length < 8) {
        setError("Choose a password of at least 8 characters.");
        return;
      }
      if (!passwordsMatch) {
        setError("The two passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teammates/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          jobTitle: jobTitle.trim(),
          phone: phone.replace(/\D/g, ""),
          phoneExtension: phoneExtension.trim(),
          // Usually a `data:` URL — see the note in `lib/teammates/invite-acceptance.server.ts`,
          // which stores it under the organization's prefix so the seat holds a real R2 key.
          headshot: headshot.trim() || null,
          password,
          cardContactType,
          displayEmail,
          displayPhone,
          enableContactButton: enableCtaButton,
          ctaType: enableCtaButton ? ctaType : null,
          schedulingUrl:
            enableCtaButton && ctaType === "schedule"
              ? schedulingUrl.trim()
              : "",
          websiteUrl:
            enableCtaButton && ctaType === "contact"
              ? buildContactFormHref(
                  view.email ?? "",
                  view.organizationName ?? "",
                  `${firstName} ${lastName}`.trim() || view.email || "",
                  headshot,
                  "",
                  jobTitle,
                  getActiveContactFormTopicLabels(contactFormTopics),
                  view.sectionName ?? null,
                )
              : "",
          contactFormTopics,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        status?: string;
        email?: string;
        landingUrl?: string;
        createdAccount?: boolean;
        message?: string;
      };
      if (!response.ok || body.status !== "accepted") {
        setError(body.message ?? "Could not accept this invitation.");
        return;
      }
      setAccepted({
        landingUrl: body.landingUrl ?? "/benefits",
        email: body.email ?? view.email ?? "",
        createdAccount: Boolean(body.createdAccount),
      });
    } catch {
      setError("Could not accept this invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-lg dark:bg-gray-800 dark:border-gray-700 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading invitation…
        </CardContent>
      </Card>
    );
  }

  // ── Accepted ────────────────────────────────────────────────────────────────
  if (accepted) {
    const signInUrl = `/signin?callbackUrl=${encodeURIComponent(accepted.landingUrl)}`;
    return (
      <div className="flex flex-col items-center space-y-4 py-2 w-full">
        <div className="text-center space-y-1 max-w-lg">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              You&rsquo;re set up
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {accepted.createdAccount
              ? `Your account is ready for ${accepted.email}.`
              : `${accepted.email} is already registered — your access has been connected to it.`}
          </p>
        </div>
        <Card className="w-full max-w-lg dark:bg-gray-800 dark:border-gray-700 shadow-sm">
          <CardContent className="pt-3 space-y-2.5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sign in with your password to see the plan you were invited to.
            </p>
            <Button asChild className="w-full">
              <Link href={signInUrl}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Anything that is not redeemable ─────────────────────────────────────────
  if (!view || view.status !== "ok") {
    const isAccepted = view?.status === "already_accepted";
    return (
      <Card className="w-full max-w-lg dark:bg-gray-800 dark:border-gray-700 shadow-sm">
        <CardContent className="pt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isAccepted ? "Already accepted" : "This invitation can’t be used"}
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {error ?? "Ask the person who invited you to send a new invitation."}
          </p>
          {isAccepted ? (
            <Button asChild className="w-full">
              <Link href="/signin">Sign in</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // ── Redeemable ──────────────────────────────────────────────────────────────
  //
  // The firm is named only when it adds something. A solo advisor's organization mirrors their
  // own `User` row, so naming it unconditionally produced "Eddie Taliaferro invited you on behalf
  // of Eddie Taliaferro to help with …". `inviterFirmLabel` is the same rule the invitation email
  // applies, so the two cannot word one invitation differently.
  const inviterFirm = inviterFirmLabel(view.inviterName, view.organizationName);

  /**
   * What the organization filled in for the invitee, said in the order the fields appear.
   *
   * The seat is often created from a contact the advisor already had, so some of these values are
   * not the invitee's own typing. Naming them — rather than one blanket line — is what lets the
   * notice read as a fact about this form: the headshot is usually the surprise, since a photo is
   * the one thing nobody expects to already be there. `headshotFromOrg` narrows that to a photo
   * the invitee has not replaced yet, so its note disappears the moment they upload their own.
   */
  const prefilledLabels: string[] = [];
  if (view.headshot) prefilledLabels.push("headshot");
  if (view.firstName || view.lastName) prefilledLabels.push("name");
  if (view.jobTitle) prefilledLabels.push("job title");
  if (view.phone || view.phoneExtension) prefilledLabels.push("phone number");

  const headshotFromOrg = Boolean(view.headshot) && headshot === view.headshot;

  /**
   * What they were given, worded from what the seat actually covers.
   *
   * Three different invitations used to read the same way: "…to help with Team Members LLC" was
   * printed whether the person had been given that one plan, three plans, or a seat that covers
   * every plan the firm has and every one it creates later. The clause is now built from the
   * facts, in that order of specificity:
   *
   *   - the All Plans flag wins, because it is a statement about the FUTURE too — "all of their
   *     plans" stays true when the organization adds its next plan, which a count never would;
   *   - several plans are counted rather than listed, and no single one is named;
   *   - one plan is named, which is the case the old copy was written for.
   *
   * Nothing to say (a seat with no plans assigned yet) leaves the clause out entirely, so the
   * sentence still ends cleanly after the firm rather than claiming access that was not given.
   */
  const scopeClause = view.allPlans
    ? " to help with all of their plans"
    : (view.planCount ?? 0) > 1
      ? ` to help with ${view.planCount} plans`
      : view.planName
        ? ` to help with ${view.planName}`
        : "";

  // Live-preview values. `previewWebsiteUrl` mirrors what submit sends for a Contact
  // Form CTA; `previewButtonType` maps the four CTA choices onto the card's legacy
  // button names, exactly as the wizard's slide does.
  const previewName =
    `${firstName} ${lastName}`.trim() || view.email || "Your name";
  const previewButtonType =
    ctaType === "schedule"
      ? "calendar"
      : ctaType === "call"
        ? "phone"
        : ctaType === "email"
          ? "email"
          : "url";
  const previewWebsiteUrl =
    enableCtaButton && ctaType === "contact"
      ? buildContactFormHref(
          view.email ?? "",
          view.organizationName ?? "",
          previewName,
          headshot,
          "",
          jobTitle,
          getActiveContactFormTopicLabels(contactFormTopics),
          view.sectionName ?? null,
        )
      : undefined;

  return (
    <div className="flex flex-col items-center space-y-4 py-2 w-full">
      {/* Header — the same shape the wizard's contact form opens with: an icon and the title on
          one centred line, the explanation under it in the quieter text size. */}
      <div className="text-center space-y-1 max-w-lg">
        <div className="mb-4 flex items-center justify-center gap-2">
          <img className="h-8" src="/plantelligence-logos/pt_web_light.png" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <UserPlus className="w-5 h-5 text-accent-blue" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            You&rsquo;ve been invited
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {view.inviterName ? `${view.inviterName} invited you` : "You have been invited"}
          {inviterFirm ? ` on behalf of ${inviterFirm}` : ""}
          {scopeClause}
          {view.sectionName ? ` — ${view.sectionName}.` : "."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-3xl items-start">
      <Card className="w-full dark:bg-gray-800 dark:border-gray-700 shadow-sm">
        <CardContent className="pt-3 space-y-2.5">
          {/* Some of these fields came from the organization's own entry, not from the invitee's
              typing. Said once, at the top, before the fields — so it frames everything below as
              editable rather than looking like a warning bolted onto the photo. */}
          {prefilledLabels.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-blue" />
              <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                {inviterFirm ?? "The organization"} pre-filled your{" "}
                {formatSentenceList(prefilledLabels)}. You can edit everything on this page — your
                changes replace what they entered.
              </p>
            </div>
          ) : null}

          {/* Headshot first, as the contact form has it: the photo is the part of this form that
              cannot be typed, so it is offered before the fields that usually arrive filled in. */}
          <div className="space-y-1" data-field="headshot">
            <Label className="dark:text-gray-300 text-xs font-medium">
              Headshot (optional)
            </Label>
            <UniversalImageEditorModal
              value={headshot || ""}
              fileName={headshotFileName || ""}
              onChange={(value, fileName) => {
                setHeadshot(value);
                setHeadshotFileName(fileName || "");
              }}
              onRemove={() => {
                setHeadshot("");
                setHeadshotFileName("");
              }}
              placeholder="Upload Headshot"
              modalTitle="Headshot"
              modalDescription="Upload a clear, front-facing photo. Keep the face inside the circle guide for best results."
              saveButtonText="Save Headshot"
              type="headshot"
              autoSizeOnOpen={true}
              forceCircularGuidelines={true}
            />
            {headshotFromOrg ? (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Added by {inviterFirm ?? "the organization"} — upload a new photo to replace it.
              </p>
            ) : null}
          </div>

          <div className="space-y-1" data-field="firstName">
            <Label className="dark:text-gray-300 text-xs font-medium">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. John"
              disabled={isSubmitting}
              className={cn("h-8 text-sm", hasError("firstName") && "border-red-500")}
            />
            {hasError("firstName") && (
              <p className="text-[10px] text-red-500">First name is required</p>
            )}
          </div>

          <div className="space-y-1" data-field="lastName">
            <Label className="dark:text-gray-300 text-xs font-medium">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Smith"
              disabled={isSubmitting}
              className={cn("h-8 text-sm", hasError("lastName") && "border-red-500")}
            />
            {hasError("lastName") && (
              <p className="text-[10px] text-red-500">Last name is required</p>
            )}
          </div>

          <div className="space-y-1" data-field="jobTitle">
            <Label className="dark:text-gray-300 text-xs font-medium">Job Title</Label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. HR Director"
              disabled={isSubmitting}
              className="h-8 text-sm"
            />
          </div>

          {/* Phone and extension on one row, as the contact form pairs them. Email is the
              invitation's own address and cannot be changed here, which is why it is read-only
              and carries the lock note instead of a validation message. */}
          <div className="space-y-1" data-field="phone">
            <Label className="dark:text-gray-300 text-xs font-medium">Phone</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="tel"
                  value={phone ? formatPhoneNumber(phone) : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    if (digits.length <= 10) setPhone(digits);
                  }}
                  placeholder="(555) 123-4567"
                  disabled={isSubmitting}
                  className={cn("h-8 text-sm", hasError("phone") && "border-red-500")}
                />
              </div>
              <div className="w-20">
                <Input
                  type="text"
                  maxLength={5}
                  value={phoneExtension}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value.length <= 8) setPhoneExtension(value);
                  }}
                  placeholder="Ext."
                  disabled={isSubmitting}
                  className="h-8 text-sm text-center"
                />
              </div>
            </div>
            {hasError("phone") && (
              <p className="text-[10px] text-red-500">Enter a complete phone number</p>
            )}
          </div>

          <div className="space-y-1" data-field="email">
            <Label className="dark:text-gray-300 text-xs font-medium">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <Input
                value={view.email ?? ""}
                readOnly
                disabled
                className="h-8 pl-9 text-sm"
              />
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
              <Lock className="h-3 w-3" />
              This invitation is for this address, so it can&rsquo;t be changed here.
            </p>
          </div>

          {/* ── Card type ──
              Individual vs Team / Support Line — the same choice the Key Contact form
              offers. It decides which card layout the person appears on. */}
          <div className="space-y-1.5" data-field="contactType">
            <Label className="dark:text-gray-300 text-xs font-medium">
              Card Type
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { value: "individual", label: "Individual", hint: "A person" },
                  {
                    value: "team_support",
                    label: "Team / Support Line",
                    hint: "A department or group",
                  },
                ] as const
              ).map((opt) => {
                const isActive = cardContactType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCardContactType(opt.value)}
                    disabled={isSubmitting}
                    className={cn(
                      "flex flex-col rounded-md border px-2.5 py-1.5 text-left transition-all",
                      isActive
                        ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                    )}
                  >
                    <span className="text-[11px] font-medium text-gray-900 dark:text-gray-100">
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Show on contact card ──
              The email / phone visibility toggles, directly below the Email field as
              the wizard has them, with the same reachability rule: at least one way
              to reach the person is visible, or a call-to-action button is provided. */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2">
            <Label className="dark:text-gray-300 text-xs font-medium">
              Show on contact card
            </Label>
            <p
              className={cn(
                "text-[10px]",
                validationAttempted &&
                  !hasReachableMethod({
                    displayEmail,
                    displayPhone,
                    enableContactButton: enableCtaButton,
                  })
                  ? "text-red-500"
                  : "text-gray-400 dark:text-gray-500",
              )}
            >
              {CONTACT_VISIBILITY_HELPER_TEXT}
            </p>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="display-email"
                checked={displayEmail}
                onCheckedChange={(checked) => setDisplayEmail(checked === true)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="display-email"
                className="text-xs font-medium cursor-pointer dark:text-gray-300"
              >
                Email
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="display-phone"
                checked={displayPhone}
                onCheckedChange={(checked) => setDisplayPhone(checked === true)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="display-phone"
                className="text-xs font-medium cursor-pointer dark:text-gray-300"
              >
                Phone
              </Label>
            </div>
          </div>

          {/* ── Call to action button ──
              The same four choices the Key Contact form offers. "Contact Form" is the
              Plantelligence-branded /contact page, whose submissions are delivered to
              this person's invited email. */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2.5">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-cta-button"
                checked={enableCtaButton}
                onCheckedChange={(checked) => setEnableCtaButton(checked === true)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="enable-cta-button"
                className="text-xs font-medium cursor-pointer dark:text-gray-300"
              >
                Add a call to action button
              </Label>
            </div>

            {enableCtaButton && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { value: "schedule", label: "Schedule Appt.", icon: Calendar },
                      { value: "call", label: "Call", icon: Phone },
                      { value: "email", label: "Email", icon: Mail },
                      { value: "contact", label: "Contact Form", icon: Globe },
                    ] as const
                  ).map((opt) => {
                    const isActive = ctaType === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCtaType(opt.value)}
                        disabled={isSubmitting}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition-all",
                          isActive
                            ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 flex-shrink-0",
                            isActive
                              ? "text-accent-blue"
                              : "text-gray-400 dark:text-gray-500",
                          )}
                        />
                        <span className="text-[11px] font-medium">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {ctaType === "schedule" && (
                  <div className="space-y-1" data-field="schedulingUrl">
                    <Label className="dark:text-gray-300 text-xs font-medium">
                      Scheduling URL <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={schedulingUrl}
                      onChange={(e) => setSchedulingUrl(e.target.value)}
                      placeholder="https://calendly.com/..."
                      disabled={isSubmitting}
                      className="h-8 text-sm"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      e.g. Calendly, Microsoft Bookings.
                    </p>
                  </div>
                )}

                {ctaType === "contact" && (
                  <div className="space-y-2">
                    <p className="rounded bg-gray-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                      This opens a Plantelligence-branded contact form. Submissions are
                      delivered to {view.email ? view.email : "this person's email"}.
                    </p>
                    <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
                      <ContactFormTopicBuilder
                        category={view.sectionName ?? null}
                        topics={contactFormTopics}
                        onChange={setContactFormTopics}
                      />
                    </div>
                  </div>
                )}

                {ctaType === "call" && (
                  <p className="rounded bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                    {phone
                      ? `Calls ${formatPhoneNumber(phone)}${phoneExtension ? ` ext. ${phoneExtension}` : ""}.`
                      : "Complete the Phone field above to enable this button."}
                  </p>
                )}

                {ctaType === "email" && (
                  <p className="rounded bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                    Opens an email to {view.email ?? "this address"}.
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Credentials ──
              Only when this acceptance creates the account. An existing account keeps its own
              password — an invitation must never become a way to overwrite someone's
              credentials — so the fields are replaced by the reason they are absent. */}
          {creatingAccount ? (
            <>
              <div className="space-y-1" data-field="password">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    // Room for both icons: the match tick sits at `right-10` and the eye at
                    // `right-3`, so the value must not run under either.
                    className={cn(
                      "h-8 pr-14 text-sm",
                      hasError("password") && "border-red-500",
                    )}
                  />
                  {passwordsMatch && (
                    <CheckCircle2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    disabled={isSubmitting}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  At least 8 characters.
                </p>
                {hasError("password") && (
                  <p className="text-[10px] text-red-500">
                    Choose a password of at least 8 characters
                  </p>
                )}
              </div>

              <div className="space-y-1" data-field="confirmPassword">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Verify Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    disabled={isSubmitting}
                    className={cn(
                      "h-8 pr-14 text-sm",
                      hasError("confirmPassword") && "border-red-500",
                    )}
                  />
                  {passwordsMatch && (
                    <CheckCircle2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    disabled={isSubmitting}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[10px] text-red-500">
                    The two passwords do not match
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400">
              You already have an account with this address. Accepting connects your access to it
              and keeps your existing password.
            </p>
          )}

          {error ? <p className="text-xs text-red-500">{error}</p> : null}

          <Button
            className="w-full"
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {creatingAccount ? "Accept invitation" : "Accept and continue"}
          </Button>

          {/* The collaborator boundary, stated only for the people it binds: a Team Member's
              access is whatever the organization granted, and telling them they can "never
              publish" would be untrue the moment they hold a seat that can. */}
          {view.personType === "collaborator" ? (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              You can never publish, invite, delete, or see organization settings.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Right column: the SAME card the portal renders, driven live by the fields
          on the left — headshot, name, title, and the Show on card / CTA choices.
          Wrapped in the wizard's StickyPreviewContainer so it pins on scroll exactly
          as the Key Contact slide does. */}
      <StickyPreviewContainer>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue mb-1 text-center">
          Portal Preview
        </span>
        <SmallVerticalCard
          contact={{
            id: "invite-preview",
            name: previewName,
            firstName,
            lastName,
            title: jobTitle,
            email: view.email ?? "",
            phone,
            phoneExtension,
            headshot: headshot || undefined,
            companyName: view.organizationName ?? "",
            contactType: cardContactType,
            displayEmail,
            displayPhone,
            enableContactButton: enableCtaButton,
            contactButtonType: enableCtaButton ? previewButtonType : undefined,
            schedulingUrl:
              enableCtaButton && ctaType === "schedule" ? schedulingUrl : undefined,
            websiteUrl: previewWebsiteUrl,
          }}
          brandColor={PREVIEW_BRAND_COLOR}
          secondaryColor={PREVIEW_SECONDARY_COLOR}
          appointmentLink=""
          index={0}
          disableAnimation
          baselineBackgroundColor="#ffffff"
          compact
        />
      </StickyPreviewContainer>
      </div>
    </div>
  );
}
