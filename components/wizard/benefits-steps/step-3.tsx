"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useBenefitsWizardStore,
  FAQItem,
  SupportContact,
} from "@/lib/benefits-wizard-store";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import {
  MAX_SUPPORT_CONTACTS_PER_BENEFIT,
  canAddSupportContact,
} from "@/lib/benefit-contacts";
import { fetchClientOnce } from "@/lib/fetch-client";
import { Card, CardContent } from "@/components/ui/card";
import { Headshot } from "@/components/ui/headshot";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  HelpCircle,
  Users,
  Check,
  ChevronDown,
  GripVertical,
  Save,
  Loader2,
  Eye,
  Info,
  AlertTriangle,
  Pencil,
  UserPlus,
  Armchair,
  X,
  BadgeCheck,
  MailCheck,
  UserCheck,
} from "lucide-react";
import { KeyContact } from "@/types/new-client-wizard";
import {
  PROFILE_STATE_LABELS,
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
  type TeammateProfileState,
} from "@/types/teammate";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { InviteCollaboratorDialog } from "@/components/pages/benefits/invite-collaborator-dialog";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BenefitContactDialog } from "./benefit-contact-dialog";
import { GiveTeamSeatDialog } from "./give-team-seat-dialog";
import { invalidateClientCache } from "@/lib/fetch-client";
import { toApiBenefitCategory } from "@/lib/benefit-draft";
import { formatPhoneWithExtension } from "@/lib/phone-utils";
import { useDismissibleAlert } from "@/hooks/use-dismissible-alert";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions-faq";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** One person assigned to this plan, as `/api/teammates/plan-assignments` returns it. */
interface PlanCollaboratorRow {
  assignmentId: string;
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  companyName: string | null;
  role: TeammateAssignmentRole;
  categoryScope: "all" | "selected";
  categories: string[];
  state: TeammateProfileState;
  deactivatedAt: string | null;
  inviteDueDate: string | null;
}

/**
 * The status that stands in for "Give Team Seat" — muted when there is nothing for the
 * advisor to do, green when the person is already handled. Sized like the button it
 * replaces (`h-8 w-full`) so every card in the row keeps the same height.
 */
const SEAT_STATUS_MUTED_CLASS =
  "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-3 text-xs font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800/60";
const SEAT_STATUS_DONE_CLASS =
  "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400";
/**
 * The status shown while the seat lookup is still in flight.
 *
 * Sized like the other two (`h-8 w-full`) on purpose: the placeholder and the button it may
 * become occupy the same box, so the card does not resize when the answer lands. Dashed and
 * muted so it reads as "not answered yet" rather than as one of the real states.
 */
const SEAT_STATUS_PENDING_CLASS =
  "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-200 bg-gray-50/60 px-3 text-xs font-medium text-muted-foreground dark:border-gray-700 dark:bg-gray-800/40";

/**
 * The placeholder roster, shown while the plan's contacts are still being read.
 *
 * Four cards, because that is what one row holds (`lg:grid-cols-4`), each mirroring the real
 * card's boxes — selection control, headshot, the row of actions, the name block, and the seat
 * slot — so the reveal is a fade rather than a relayout. Before this existed the section said
 * "No support contacts available." for the two to three seconds the plan read took, which is a
 * claim about the plan made while the answer was still in flight.
 */
function SupportContactCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card
          key={index}
          aria-hidden="true"
          className="border-gray-100 dark:border-gray-700 dark:bg-gray-800"
        >
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="ml-auto h-7 w-7 shrink-0 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-full rounded-md" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export function BenefitsStep3({
  section,
}: {
  /** When set, renders only the matching section (used by the Edit Benefit page,
   *  where Contacts and FAQs are separate tabs). */
  section?: "contacts" | "faqs";
} = {}) {
  const { stepData, saveStepData } = useBenefitsWizardStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Which FAQ block sections are open. Starts open, like the Contacts sections above, so
  // nothing is hidden behind a click the advisor did not ask for.
  const [openFaqSection, setOpenFaqSection] = useState<string[]>(["faqs"]);
  const [savePending, setSavePending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Support Contacts preview — the portal's "Have Questions?" cards. Its own state
  // because `previewOpen` previews the FAQ section, a different part of the page.
  const [contactsPreviewOpen, setContactsPreviewOpen] = useState(false);
  // Plan-level delete: the contact the confirm dialog is asking about, and whether the
  // request is in flight.
  const [contactPendingDelete, setContactPendingDelete] =
    useState<KeyContact | null>(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  // Edit contact (plan-level): the contact the shared editor is open for.
  const [editingContact, setEditingContact] = useState<KeyContact | null>(null);
  // "Give Team Seat": the contact the seat confirm dialog is asking about. Deliberately
  // separate from `editingContact` — editing the person and giving them a paid seat are
  // different questions, and one dialog must never answer for the other.
  const [contactPendingSeat, setContactPendingSeat] = useState<KeyContact | null>(
    null,
  );
  const step1Data = stepData.step1;
  const currentStep3Data = stepData.step3 || {
    faqs: [],
    supportContacts: [],
    currentSubStep: "a",
  };

  // Support contacts selected for THIS benefit, measured against the per-benefit cap
  // (lib/benefit-contacts). Drives the notice and the row states below; `toggleContact`
  // re-checks the cap against the live store so it cannot be raced by fast clicks.
  const selectedSupportCount = currentStep3Data.supportContacts.length;
  const atSupportContactLimit = !canAddSupportContact(selectedSupportCount);
  const overSupportContactLimit =
    selectedSupportCount > MAX_SUPPORT_CONTACTS_PER_BENEFIT;

  // The notice above explains a rule, so it is dismissable — `useDismissibleAlert` stores
  // the choice per device, which is the right scope for "I already know this".
  //
  // The one exception: a dismissal must not hide the OVER-cap warning. That state is not
  // the same message — it is a problem the advisor has just created, and the notice is the
  // only place the count is stated against the cap. So the notice is shown while dismissed
  // ONLY when over the cap, and the dismissal takes effect again if they drop back under.
  const { isDismissed: capNoticeDismissed, dismiss: dismissCapNotice } =
    useDismissibleAlert("benefits-support-contacts-cap");
  const showCapNotice = overSupportContactLimit || !capNoticeDismissed;

  /* ── Collaborators (T4) ──────────────────────────────────────────────
     The Contacts step is where an advisor thinks about who helps with the
     section, so the invite lives here rather than in the page's action bar. The
     scope comes from Step 1 — the plan and the benefit category — and the dialog
     receives it, never asks for it. Both accordion sections start open so neither
     set of people is hidden behind a click. */
  const [openContactSections, setOpenContactSections] = useState<string[]>([
    "support-contacts",
    "collaborators",
  ]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<PlanCollaboratorRow[]>([]);
  /**
   * The organization owner's addresses, reported beside the assignments.
   *
   * The owner is deliberately not a teammate — `contact-mirror.server.ts` skips them,
   * because their canonical representation is `Organization.ownerUserId` rather than a
   * TeammateProfile — so they are absent from `collaborators` and this is the only way to
   * recognise their Support Contact card.
   */
  const [ownerEmails, setOwnerEmails] = useState<string[]>([]);
  // Bumped after an invite so the list re-reads without a page reload.
  const [collaboratorsRefreshKey, setCollaboratorsRefreshKey] = useState(0);
  /**
   * Whether the seat lookup has answered — the assignments AND the owner address list, which
   * arrive in one response.
   *
   * Until it lands, `teammateByEmail` and `ownerEmailSet` are empty, so every card derives
   * `seatStatus === null`: the state meaning "no seat, no invitation", which renders the
   * button. Cards therefore looked like they were inviting somebody who was already a Team
   * Member — or the organization owner — and then flipped to the badge a few seconds later.
   * While this is false the card shows a placeholder instead of asserting either answer.
   */
  const [seatStatusResolved, setSeatStatusResolved] = useState(false);
  /**
   * Whether the plan's contact roster is known.
   *
   * `localContacts` starts empty and is filled by Step 1's full-plan read (or this step's own
   * fallback). A plan with no contacts and a plan whose contacts have not arrived both look
   * empty, and only the first may say "No support contacts available." — the section used to
   * say it for both.
   */
  const [contactsResolved, setContactsResolved] = useState(false);
  const invitePlanId = step1Data?.planId || "";
  const inviteCategory = String(step1Data?.benefitCategory || "");

  /* The Custom benefit this draft is creating — Step 1's Custom Category Name. Only
     meaningful for the Custom hub: for a canonical category `benefitTitle` is that
     benefit's own headline, not a category, so it must not be offered as one. The
     comparison goes through `toApiBenefitCategory` rather than naming the hub's storage
     label here, so this cannot disagree with how the rest of the wizard spells it. */
  const currentCustomBenefit =
    toApiBenefitCategory(inviteCategory) === toApiBenefitCategory("Custom")
      ? String(step1Data?.benefitTitle || "").trim()
      : "";

  useEffect(() => {
    if (!invitePlanId) {
      setCollaborators([]);
      setOwnerEmails([]);
      // Nothing to wait for: without a plan there are no seats to look up.
      setSeatStatusResolved(true);
      return;
    }

    let cancelled = false;
    // Back to "unknown" on every run, including the refresh that follows an invite: the seat
    // that invite just created is exactly what the cards are about to report, and holding the
    // stale button until it lands is the flip this flag exists to remove.
    setSeatStatusResolved(false);

    (async () => {
      try {
        const response = await fetch(
          `/api/teammates/plan-assignments?planId=${encodeURIComponent(invitePlanId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          // No access to the plan (or it is gone): show nobody rather than an
          // error state — the section is informational.
          if (!cancelled) {
            setCollaborators([]);
            setOwnerEmails([]);
          }
          return;
        }
        const body = (await response.json()) as {
          assignments?: PlanCollaboratorRow[];
          ownerEmails?: string[];
        };
        if (!cancelled) {
          setCollaborators(body.assignments ?? []);
          setOwnerEmails(body.ownerEmails ?? []);
        }
      } catch {
        if (!cancelled) {
          setCollaborators([]);
          setOwnerEmails([]);
        }
      } finally {
        // Every path settles: a failed read falls back to the button rather than spinning
        // forever, and the lists are already empty for it.
        if (!cancelled) setSeatStatusResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invitePlanId, collaboratorsRefreshKey]);

  /**
   * The two lookups that decide what each Support Contact card shows.
   *
   * Email is the only key the two lists share: a Key Contact carries no profile id and a
   * teammate profile carries no contact id, but the mirror is keyed on the address, so one
   * person is one address on both sides.
   */
  const ownerEmailSet = useMemo(
    () => new Set(ownerEmails.map((address) => address.trim().toLowerCase())),
    [ownerEmails],
  );
  const teammateByEmail = useMemo(() => {
    const map = new Map<string, PlanCollaboratorRow>();
    for (const person of collaborators) {
      const address = person.email?.trim().toLowerCase();
      // First wins: `listPlanAssignments` orders by createdAt, so the earliest assignment
      // is the one an invitation was raised against.
      if (address && !map.has(address)) map.set(address, person);
    }
    return map;
  }, [collaborators]);

  const selectedPlan = step1Data?.selectedPlan;
  const [localContacts, setLocalContacts] = useState<KeyContact[]>([]);

  useEffect(() => {
    if (selectedPlan?.keyContacts) {
      const contacts = Array.isArray(selectedPlan.keyContacts)
        ? selectedPlan.keyContacts
        : selectedPlan.keyContacts.contacts || [];
      setLocalContacts(contacts);
      // The roster is known — including when it is legitimately empty.
      setContactsResolved(true);
      return;
    }
    if (!step1Data?.planId) {
      // No plan to read from (a deep link that lands before Step 1 knows the plan). Settle the
      // flag so the empty state with its "Go to Step 1" hint can render; leaving it unresolved
      // would show the skeleton forever.
      setContactsResolved(true);
      return;
    }

    const planId = step1Data.planId;
    let cancelled = false;

    // Fallback: the store rehydrated without `selectedPlan` (a reload that lands
    // directly on Step 3, or a deep link into this step).
    (async () => {
      try {
        // Shared single-flight cache (lib/fetch-client) — Step 1 already read this row.
        const data = await fetchClientOnce(planId);
        if (cancelled || !data) return;

        const contacts = Array.isArray(data.keyContacts)
          ? data.keyContacts
          : data.keyContacts?.contacts || [];
        setLocalContacts(contacts);

        // Merge onto the LATEST step-1 data, never the closed-over `step1Data`.
        // Spreading that snapshot wrote a stale copy of the whole step-1 record back
        // over anything Step 1 had saved while this request was in flight — a logo
        // upload, the profile prefill, or the full-plan fetch that sets
        // `selectedPlan`. It also had no abort guard, so an unmounted/unrelated
        // response could still land.
        const latest = useBenefitsWizardStore.getState().stepData.step1;
        if (!latest || latest.planId !== planId) return;
        // Step 1 already loaded a plan for this category while we were fetching —
        // its payload is the same endpoint, so there is nothing to add.
        if (latest.selectedPlan?.keyContacts) return;
        saveStepData(1, { ...latest, selectedPlan: data });
      } catch (err) {
        console.error("Error fetching contacts in Step 3:", err);
      } finally {
        // Settled either way. On failure the empty state renders, and its copy ("check your
        // connection") is the right thing to say about a read that did not come back.
        if (!cancelled) setContactsResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlan, step1Data?.planId, saveStepData]);

  // Deduplicate contacts by id to prevent duplicate rendering
  const planContacts = useMemo(() => {
    const seen = new Set<string>();
    return localContacts.filter((c: any) => {
      const id = c.id ?? c.email ?? "";
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [localContacts]);

  if (process.env.NODE_ENV === 'development') {
    // console.log("[Step 3] planContacts:", planContacts, "planId:", step1Data?.planId);
  }

  // Helper: get the latest faqsByCategory map directly from the Zustand store.
  // Reads the authoritative state to avoid stale closure issues.
  const readFaqsByCategory = (): Record<string, FAQItem[]> => {
    return useBenefitsWizardStore.getState().stepData.step3?.faqsByCategory ?? {};
  };

  // Derive the correct FAQ list for the current benefit category — computed on
  // every render. Retirement defaults are shown as a single combined list.
  const resolvedFaqs = ((): FAQItem[] => {
    const cat = step1Data?.benefitCategory;
    if (!cat) return [];
    const saved = readFaqsByCategory()[cat];
    let list: FAQItem[] =
      saved && saved.length > 0 ? saved : (DEFAULT_FAQS[cat] ?? []);
    // Merge any leftover "optional retirement adds" that an earlier build of
    // this wizard persisted separately, so no existing FAQ edits are lost now
    // that the split accordion has been reverted.
    if (cat === "Retirement") {
      const leftover = (useBenefitsWizardStore.getState().stepData.step3 as any)
        ?.optionalRetirementFaqs as FAQItem[] | undefined;
      if (Array.isArray(leftover) && leftover.length > 0) {
        const ids = new Set(list.map((f) => f.id));
        const missing = leftover.filter((f) => !ids.has(f.id));
        if (missing.length > 0) list = [...list, ...missing];
      }
    }
    return list;
  })();

  // Persist a modified FAQ list to both the per-category map and the store.
  const persistFaqs = (next: FAQItem[]) => {
    const cat = step1Data?.benefitCategory;
    if (!cat) return;
    const latestStep3 = useBenefitsWizardStore.getState().stepData.step3 || { faqs: [], supportContacts: [], currentSubStep: "a" };
    const latestByCategory = latestStep3.faqsByCategory ?? {};
    saveStepData(3, {
      ...latestStep3,
      faqs: next,
      faqsByCategory: { ...latestByCategory, [cat]: next },
    });
  };

  // Handle FAQ changes
  const updateFaq = (id: string, updates: Partial<FAQItem>) => {
    const newFaqs = resolvedFaqs.map((faq) =>
      faq.id === id ? { ...faq, ...updates } : faq,
    );
    persistFaqs(newFaqs);
  };

  const addFaq = () => {
    const id = uuidv4();
    const newFaq: FAQItem = {
      id,
      question: "New Question?",
      answer: "Provide an answer here.",
      linkLabel: "Learn More",
      linkHref: "#",
      enabled: true,
    };
    const newFaqs = [newFaq, ...resolvedFaqs];
    persistFaqs(newFaqs);
    setExpandedId(id);
  };

  const removeFaq = (id: string) => {
    const newFaqs = resolvedFaqs.filter((faq) => faq.id !== id);
    persistFaqs(newFaqs);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = resolvedFaqs.findIndex(
        (f) => f.id === active.id,
      );
      const newIndex = resolvedFaqs.findIndex((f) => f.id === over.id);
      const newFaqs = arrayMove(resolvedFaqs, oldIndex, newIndex);
      persistFaqs(newFaqs);
    }
  };

  // Save FAQs to the server immediately (draft persist) via the new Benefit API
  const handleSaveFaqs = async () => {
    const planId = step1Data?.planId;
    const benefitCategory = step1Data?.benefitCategory;
    if (!planId || !benefitCategory) {
      toast.error("Missing plan or category data. Please complete Step 1 first.");
      return;
    }

    setSavePending(true);
    try {
      // Normalize "Custom" → "Company / Plan Sponsor" for the API
      const category = benefitCategory === "Custom"
        ? "Company / Plan Sponsor"
        : benefitCategory;

      const faqsToSave = resolvedFaqs;

      const updateRes = await fetch(
        `/api/clients/${planId}/benefits/${encodeURIComponent(category)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faqs: faqsToSave,
            supportContacts: currentStep3Data.supportContacts,
          }),
        },
      );

      const updateResult = await updateRes.json();
      if (!updateResult.success) throw new Error(updateResult.error || "Failed to save FAQs");

      toast.success("FAQs saved successfully!");
    } catch (error: any) {
      console.error("FAQ save error:", error);
      toast.error("Failed to save FAQs", {
        description: error.message,
      });
    } finally {
      setSavePending(false);
    }
  };

  // Stamp which plan + benefit category the selected support contacts belong to.
  // A page refresh resets `supportContactsLoadedCategories` to [], so this context
  // lets the Step 1 pre-population effect treat this selection as a legitimate draft
  // for THIS benefit and never clear it.
  const supportContactsContext =
    step1Data?.planId && step1Data?.benefitCategory
      ? {
          supportContactsPlanId: step1Data.planId,
          supportContactsCategory: step1Data.benefitCategory,
        }
      : {};

  // Handle Contact changes
  const toggleContact = (contactId: string) => {
    const existing = currentStep3Data.supportContacts.find(
      (sc) => sc.contactId === contactId,
    );
    if (existing) {
      const newContacts = currentStep3Data.supportContacts.filter(
        (sc) => sc.contactId !== contactId,
      );
      saveStepData(3, {
        ...currentStep3Data,
        ...supportContactsContext,
        supportContacts: newContacts,
      });
    } else {
      // The cap is enforced here as well as in the row styling: two fast clicks must
      // not slip a fifth contact past a stale render.
      const liveCount =
        useBenefitsWizardStore.getState().stepData.step3?.supportContacts.length ??
        0;
      if (!canAddSupportContact(liveCount)) {
        toast.error(
          `Up to ${MAX_SUPPORT_CONTACTS_PER_BENEFIT} support contacts per benefit`,
          {
            description:
              "Deselect one of the selected contacts first — these cards are what employees see on the benefit page.",
          },
        );
        return;
      }
      const contact = planContacts.find((c) => c.id === contactId);
      const newContact: SupportContact = {
        contactId,
        title: contact?.title || "Support Contact",
        description: "Contact for any questions regarding this benefit.",
        enabled: true,
      };
      saveStepData(3, {
        ...currentStep3Data,
        ...supportContactsContext,
        supportContacts: [...currentStep3Data.supportContacts, newContact],
      });
    }
  };

  const updateSupportContact = (
    contactId: string,
    updates: Partial<SupportContact>,
  ) => {
    const newContacts = currentStep3Data.supportContacts.map((sc) =>
      sc.contactId === contactId ? { ...sc, ...updates } : sc,
    );
    saveStepData(3, {
      ...currentStep3Data,
      ...supportContactsContext,
      supportContacts: newContacts,
    });
  };

  // Map FAQs and contacts for preview
  const previewFaqs: DynamicFAQItem[] = useMemo(() =>
    resolvedFaqs
      .filter(f => f.enabled && f.question && f.answer)
      .map(f => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        linkLabel: f.linkLabel || undefined,
        linkHref: f.linkHref && f.linkHref !== "#" ? f.linkHref : undefined,
      })),
    [resolvedFaqs],
  );

  /**
   * Delete a contact from the PLAN — removes it from `Client.keyContacts`, so it
   * disappears for every benefit, not just this one. `toggleContact` above is the
   * non-destructive alternative (include/exclude for this benefit only).
   *
   * Persisted immediately rather than deferred to the wizard's save. `saveBenefit`
   * rebuilds `keyContacts` by starting FROM the stored rows and overlaying the
   * wizard's edits, so a contact removed only from local state has no override and
   * would come straight back on the next save.
   */
  const deleteContact = async (contact: KeyContact) => {
    const planId = step1Data?.planId;
    const contactId = String(contact?.id ?? "");
    if (!planId || !contactId) return;

    setIsDeletingContact(true);
    try {
      const remaining = localContacts.filter(
        (c) => String(c?.id) !== contactId,
      );

      const res = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyContacts: remaining }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(
          result?.error || `Failed to delete contact (${res.status})`,
        );
      }

      // The plan row changed — the shared cache must not serve the old copy.
      invalidateClientCache(planId);

      setLocalContacts(remaining);

      // Keep the store's copy of the plan in step, because `saveBenefit` merges FROM
      // `selectedPlan.keyContacts`: leaving the deleted contact there would recreate it.
      const latest = useBenefitsWizardStore.getState().stepData.step1;
      if (latest && latest.planId === planId) {
        const selectedPlan = latest.selectedPlan
          ? { ...(latest.selectedPlan as any), keyContacts: remaining }
          : latest.selectedPlan;
        saveStepData(1, {
          ...latest,
          selectedPlan,
          // The benefit's primary contact must not point at a contact that no longer
          // exists. `saveBenefit` re-seeds that id into `supportContacts`, so a stale
          // one would resurrect the deleted person as this benefit's support contact.
          contactId: latest.contactId === contactId ? "" : latest.contactId,
        });
      }

      // Drop it from this benefit's support contacts too.
      const step3 = useBenefitsWizardStore.getState().stepData.step3;
      if (step3?.supportContacts?.some((sc) => sc.contactId === contactId)) {
        saveStepData(3, {
          ...step3,
          ...supportContactsContext,
          supportContacts: step3.supportContacts.filter(
            (sc) => sc.contactId !== contactId,
          ),
        });
      }

      toast.success("Contact removed from this plan");
    } catch (error: any) {
      toast.error("Could not delete the contact", {
        description: error?.message,
      });
    } finally {
      setIsDeletingContact(false);
    }
  };

  /**
   * Persist a contact the shared editor produced.
   *
   * Written straight away rather than left in local state, for the same reason
   * `deleteContact` is: `saveBenefit` merges `keyContacts` by starting FROM the stored
   * rows, so a change that never reached the server can be lost on the next save.
   * Throwing hands the message back to the dialog, which toasts it and stays open.
   */
  const handleContactSubmitted = async (updated: KeyContact) => {
    const planId = step1Data?.planId;
    if (!planId) throw new Error("No plan selected");

    const nextContacts = localContacts.map((c) =>
      String(c?.id) === String(updated.id) ? updated : c,
    );

    const res = await fetch(`/api/clients/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyContacts: nextContacts }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) {
      throw new Error(
        result?.error || `Failed to save the contact (${res.status})`,
      );
    }

    // The plan row changed — the shared cache must not serve the old copy.
    invalidateClientCache(planId);
    setLocalContacts(nextContacts);

    // Keep the store's copy of the plan in step: `saveBenefit` merges FROM
    // `selectedPlan.keyContacts`, so the stored copy must already hold the change.
    const latest = useBenefitsWizardStore.getState().stepData.step1;
    if (latest && latest.planId === planId) {
      const selectedPlan = latest.selectedPlan
        ? { ...(latest.selectedPlan as any), keyContacts: nextContacts }
        : latest.selectedPlan;
      saveStepData(1, { ...latest, selectedPlan });
    }

    toast.success("Contact updated");
  };

  const previewContacts: FAQContact[] | undefined = useMemo(() => {
    const enabled = currentStep3Data.supportContacts.filter(sc => sc.enabled);
    if (enabled.length === 0) return undefined;
    return enabled.map(sc => {
      const matched = planContacts.find(c => c.id === sc.contactId);
      return {
        id: sc.contactId,
        title: sc.title || matched?.name || `${matched?.firstName ?? ""} ${matched?.lastName ?? ""}`.trim() || "Support Contact",
        description: sc.description || matched?.customRole || matched?.title || "",
        email: matched?.email || "",
        phone: matched?.phone || "",
        headshot: matched?.headshot || undefined,
      } as FAQContact;
    });
  }, [currentStep3Data.supportContacts, planContacts]);

  const brandColor = step1Data?.selectedPlan?.brandColor
    || step1Data?.selectedPlan?.brandColors?.primary
    || "#1F3A60";
  const secondaryColor = step1Data?.selectedPlan?.secondaryColor
    || step1Data?.selectedPlan?.brandColors?.secondary
    || "#6B7280";

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-20">
        {/* Support Contacts + Collaborators — two accordion sections, so each set
            of people on this benefit is its own collapsible block. */}
        {(!section || section === "contacts") && (
        <>
        {/* Section header. The per-person actions belong to the sections that own the
            people: Support Contacts carries Preview, Collaborators carries the invite.
            "Add Benefit" and "Edit Benefit" both render this step, so one header serves
            both surfaces. */}
        <div className="rounded-xl bg-card px-4 py-3">
          <h2 className="text-lg font-bold text-foreground">Contacts & FAQs</h2>
          <p className="text-xs text-muted-foreground">
            Who employees reach out to, and who can help complete this section.
          </p>
        </div>
        <Accordion
          type="multiple"
          value={openContactSections}
          onValueChange={setOpenContactSections}
          className="space-y-4"
        >
        <AccordionItem
          value="support-contacts"
          className="rounded-xl border bg-card shadow-md"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
              <Users className="w-5 h-5 shrink-0 text-accent-blue" />
              <span className="text-lg font-bold text-foreground">
                Support Contacts
              </span>
              <Badge variant="secondary" className="font-medium">
                {selectedSupportCount} of {MAX_SUPPORT_CONTACTS_PER_BENEFIT}
              </Badge>
              {/* Preview the cards the advisor is choosing. Sits in the trigger (rather
                  than beside the accordion) so it reads as part of this section's header,
                  and every event is stopped so a click opens the preview instead of
                  collapsing the section it belongs to. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold"
                aria-label="Preview support contacts"
                onClick={(e) => {
                  e.stopPropagation();
                  setContactsPreviewOpen(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <span className="w-full text-xs font-normal text-muted-foreground">
                Select the contacts users should reach out to — up to{" "}
                {MAX_SUPPORT_CONTACTS_PER_BENEFIT} per benefit.
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
          <CardContent className="p-3">
            {/* The cap is a rule about the benefit page rather than a technical limit,
                so it is stated here and enforced on the rows below. Dismissable because it
                is an explanation, not a task — see `showCapNotice` for the one case where a
                stored dismissal does not keep it hidden. */}
            {showCapNotice ? (
              <div
                className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 ${
                  overSupportContactLimit
                    ? "border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20"
                    : "border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20"
                }`}
              >
                {overSupportContactLimit ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                )}
                <p className="text-[11px] leading-relaxed text-foreground/80">
                  A benefit shows{" "}
                  <b>up to {MAX_SUPPORT_CONTACTS_PER_BENEFIT} support contacts</b> —
                  these are the contact cards employees see on the benefit page.{" "}
                  {overSupportContactLimit
                    ? `This benefit has ${selectedSupportCount} selected; keep no more than ${MAX_SUPPORT_CONTACTS_PER_BENEFIT}.`
                    : `${selectedSupportCount} of ${MAX_SUPPORT_CONTACTS_PER_BENEFIT} selected.`}
                </p>
                <button
                  type="button"
                  onClick={dismissCapNotice}
                  aria-label="Dismiss this notice"
                  title="Dismiss"
                  className="ml-auto -mr-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {/* One card per contact, laid out across the row instead of stacked, so the
                whole roster is scannable at once. */}
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Unknown first, empty second: the roster is only "none" once a read has said so. */}
              {!contactsResolved ? (
                <SupportContactCardsSkeleton />
              ) : planContacts.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 sm:col-span-2 lg:col-span-4">
                  <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No support contacts available.</p>
                  <p className="text-xs text-muted-foreground mt-1">Please add contacts in Step 1 or check your connection.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 h-8 text-xs"
                    onClick={() => useBenefitsWizardStore.getState().goToStep(1)}
                  >
                    Go to Step 1 Selection
                  </Button>
                </div>
              ) : planContacts.map((contact) => {
                const isSelected = currentStep3Data.supportContacts.some(
                  (sc) => sc.contactId === contact.id,
                );
                const supportConfig = currentStep3Data.supportContacts.find(
                  (sc) => sc.contactId === contact.id,
                );
                // At the cap a contact that is not already selected cannot be added. Dim
                // it so the rule is visible before the click — `toggleContact` still
                // guards, and says why.
                const isBlockedByLimit = !isSelected && atSupportContactLimit;
                // `(555) 123-4567`, plus the extension when the contact has one. Key
                // Contacts are stored as digits, so the raw value would read as an
                // unformatted string on a card meant to preview the portal's own.
                const formattedPhone = formatPhoneWithExtension(
                  contact.phone,
                  contact.phoneExtension,
                );
                // Email is the only key the plan's contact list and the assignment list
                // share — a contact carries no profile id and a profile no contact id —
                // so it is what connects this card to the person the server knows.
                const contactEmail = (contact.email || "").trim().toLowerCase();
                const teammate = contactEmail
                  ? teammateByEmail.get(contactEmail)
                  : undefined;
                /**
                 * What replaces the seat button, or `null` when the button is right.
                 *
                 * Only `invited` and `active` count as already handled. The T7 contact
                 * mirror creates an assignment for EVERY plan contact, so an ordinary
                 * mirrored contact is on this plan with `state: "contact"` — no seat, no
                 * invitation — and offering them one is the point of the button.
                 */
                const seatStatus = !contactEmail
                  ? null
                  : ownerEmailSet.has(contactEmail)
                    ? "owner"
                    : teammate?.deactivatedAt
                      ? "deactivated"
                      : teammate?.state === "invited"
                        ? "invited"
                        : teammate?.state === "active"
                          ? "active"
                          : null;
                const inviteDueDate = teammate?.inviteDueDate
                  ? new Date(teammate.inviteDueDate).toLocaleDateString()
                  : null;

                return (
                  <Card
                    key={contact.id}
                    className={`overflow-hidden transition-all ${isSelected
                      ? "border-accent-blue shadow-sm ring-1 ring-accent-blue/20"
                      : "border-gray-100 bg-white hover:border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      } ${isBlockedByLimit ? "opacity-50" : ""}`}
                  >
                    <CardContent
                      className={`space-y-2 p-3 ${isBlockedByLimit ? "cursor-not-allowed" : "cursor-pointer"}`}
                      onClick={() => toggleContact(contact.id)}
                    >
                      {/* Photo and controls only, at opposite ends, so the selection control
                          reads as the card's top-left corner. The name deliberately is not
                          in this row — see below. */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${isSelected
                            ? "bg-accent-blue border-accent-blue text-white"
                            : "bg-white border-accent-blue dark:bg-gray-700"
                            }`}
                        >
                          {isSelected && <Check className="w-3.5 w-3.5" />}
                        </div>
                        {contact.headshot && (
                          <div className="w-8 h-8 shrink-0 overflow-hidden rounded-full border border-gray-100 dark:border-gray-700">
                            <Headshot src={contact.headshot} alt={contact.name ?? "Contact"} />
                          </div>
                        )}
                        <div className="ml-auto flex shrink-0 items-center">
                          {/* Edit this contact's own details. `stopPropagation` keeps the
                              card's toggle from firing as well — this is the person's data,
                              not this benefit's inclusion of them. */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit this contact"
                            aria-label="Edit this contact"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-accent-blue/10 hover:text-accent-blue"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingContact(contact);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {/* Plan-level delete. `stopPropagation` is essential: the card
                              itself toggles this contact on/off for the benefit, which is
                              a different (non-destructive) action. */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete this contact from the plan"
                            aria-label="Delete this contact from the plan"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactPendingDelete(contact);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Name over title, then the ways to reach them, as one left-aligned
                          column at the card's full width. Reading the name BESIDE the
                          headshot left it a strip too narrow at four-up, where it is the one
                          thing on the card that has to stay legible. `title` carries the
                          untruncated value on hover. */}
                      <div className="min-w-0 space-y-0.5">
                        <p
                          title={contact.name ||
                            `${contact.firstName} ${contact.lastName}`}
                          className="truncate text-sm font-semibold leading-tight text-foreground"
                        >
                          {contact.name ||
                            `${contact.firstName} ${contact.lastName}`}
                        </p>
                        <p
                          title={contact.title || "No Title"}
                          className="truncate text-xs leading-tight text-muted-foreground"
                        >
                          {contact.title || "No Title"}
                        </p>
                        <p title={contact.email} className="truncate text-xs leading-tight text-muted-foreground">
                          {contact.email}
                        </p>
                        {/* Shown in the display format, not the stored digits: the card is a
                            preview of what employees will read on the benefit page. */}
                        {formattedPhone ? (
                          <p title={formattedPhone} className="truncate text-xs leading-tight text-muted-foreground">
                            {formattedPhone}
                          </p>
                        ) : null}
                      </div>

                      {/* Promote this person into a paid Team Member seat — unless a seat
                          is not theirs to be given. The status stands in the button's place
                          rather than the button simply vanishing, so the card still says
                          why: the owner already has everything, and somebody who has been
                          invited (or has accepted) must not be invited twice.

                          Unresolved comes FIRST. `seatStatus` is null until the assignment
                          read lands, and null is also the real answer for "no seat, no
                          invitation" — so rendering the ladder before that read made every
                          card offer a seat to people who already had one. */}
                      {!seatStatusResolved ? (
                        <div
                          className={SEAT_STATUS_PENDING_CLASS}
                          title="Checking whether this person already holds a seat…"
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Checking…
                        </div>
                      ) : seatStatus === "owner" ? (
                        <div
                          className={SEAT_STATUS_MUTED_CLASS}
                          title="This is the organization owner. They already have full access to every plan and every category."
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Organization owner
                        </div>
                      ) : seatStatus === "invited" ? (
                        <div
                          className={SEAT_STATUS_DONE_CLASS}
                          title={
                            inviteDueDate
                              ? `Invitation sent · expires ${inviteDueDate}`
                              : "Invitation sent"
                          }
                        >
                          <MailCheck className="h-3.5 w-3.5" />
                          Invite sent
                        </div>
                      ) : seatStatus === "active" ? (
                        <div
                          className={SEAT_STATUS_DONE_CLASS}
                          title="Already a Team Member of your organization."
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Team member
                        </div>
                      ) : seatStatus === "deactivated" ? (
                        <div
                          className={SEAT_STATUS_MUTED_CLASS}
                          title="This person was deactivated. Reactivate them in Settings → People & Access rather than adding them again — the server refuses a re-add for a deactivated address."
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Deactivated
                        </div>
                      ) : (
                        /* Nothing to describe: they hold no seat and no invitation, so the
                           action IS the content. It lives inside CardContent, which owns the
                           on/off toggle for this benefit, so every event is stopped —
                           otherwise pressing it would also deselect the contact. */
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full gap-1.5 text-xs font-semibold"
                          title={
                            contact.email
                              ? "Give this contact a Team Member seat"
                              : "Add an email address for this contact first"
                          }
                          disabled={!contact.email}
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactPendingSeat(contact);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <Armchair className="h-3.5 w-3.5" />
                          Give Team Seat
                        </Button>
                      )}
                    </CardContent>

                    {/* The display copy only exists once this contact is selected for the
                        benefit, so it is the card's footer: the card grows with it instead
                        of a second block appearing beside a fixed-height row. It sits
                        outside CardContent, which owns the toggle, so typing in these
                        fields can never deselect the contact. */}
                    {isSelected && supportConfig && (
                      <div className="space-y-2.5 border-t border-gray-100 bg-gray-50 p-3 animate-in slide-in-from-top-1 duration-200 dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Display Title
                          </Label>
                          <Input
                            value={supportConfig.title}
                            onChange={(e) =>
                              updateSupportContact(contact.id, {
                                title: e.target.value,
                              })
                            }
                            placeholder="e.g. Retirement Plan Advisor"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Display Description
                          </Label>
                          <Textarea
                            value={supportConfig.description}
                            onChange={(e) =>
                              updateSupportContact(contact.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Short description..."
                            className="min-h-[50px] text-xs py-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </CardContent>
          </AccordionContent>
        </AccordionItem>

        {/* Collaborators — external people with scoped access and no seat.
            The invite action lives in THIS trigger so it is labelled by the section it
            adds to. Both sections start open (see openContactSections), so it is never
            hidden behind a click, and every event is stopped so pressing it opens the
            dialog instead of collapsing the section it belongs to. */}
        <AccordionItem
          value="collaborators"
          className="rounded-xl border bg-card shadow-md"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
              <UserPlus className="w-5 h-5 shrink-0 text-accent-blue" />
              <span className="text-lg font-bold text-foreground">
                Collaborators
              </span>
              <Badge variant="secondary" className="font-medium">
                {collaborators.length}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold"
                aria-label="Add a collaborator"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInviteOpen(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={!invitePlanId || !inviteCategory}
                title={
                  invitePlanId && inviteCategory
                    ? "Add a collaborator to complete this section"
                    : "Save the plan first, then add a collaborator"
                }
              >
                <UserPlus className="h-4 w-4" />
                Add Collaborator
              </Button>
              <span className="w-full text-xs font-normal text-muted-foreground">
                External people who help with this section. Free — no seat, and no
                publish, invite, delete or organization settings.
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0">
            <div className="space-y-3">
              {collaborators.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No collaborators yet. Invite a plan sponsor, an outside advisor or a
                  provider rep to help fill in this section.
                </p>
              ) : (
                <ul className="space-y-2">
                  {collaborators.map((person) => {
                    // The step edits ONE category, so say which people can actually
                    // work on it — an assignment scoped elsewhere is still listed,
                    // because the advisor may want to widen it.
                    const onThisSection =
                      person.categoryScope === "all" ||
                      person.categories.some(
                        (candidate) =>
                          candidate.trim().toLowerCase() ===
                          inviteCategory.trim().toLowerCase(),
                      );

                    return (
                      <li
                        key={person.assignmentId}
                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                      >
                        <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                          <Headshot
                            src={person.headshot}
                            alt={person.name}
                            monogramName={person.name}
                            wrapperClassName="rounded-full"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {person.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {person.email}
                            {person.companyName ? ` · ${person.companyName}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center gap-1">
                          <Badge variant="secondary">
                            {PRESET_ROLE_LABELS[person.role]}
                          </Badge>
                          {person.deactivatedAt ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Deactivated
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {PROFILE_STATE_LABELS[person.state]}
                            </Badge>
                          )}
                          <Badge variant={onThisSection ? "default" : "outline"}>
                            {onThisSection ? "This section" : "Other sections"}
                          </Badge>
                        </span>
                        {person.inviteDueDate ? (
                          <span className="w-full text-[11px] text-muted-foreground">
                            Due{" "}
                            {new Date(person.inviteDueDate).toLocaleDateString()}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
        </Accordion>
        </>
        )}

        {/* Edit contact — the SAME editor Step 1 uses to create one (see
            BenefitContactDialog), so the two can never drift. This page only persists
            what it hands back. */}
        <BenefitContactDialog
          open={!!editingContact}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
          mode="edit"
          contact={editingContact}
          planId={step1Data?.planId || ""}
          category={String(step1Data?.benefitCategory || "")}
          planCompanyName={step1Data?.selectedPlan?.companyName || ""}
          planLogoUrl={
            (step1Data?.selectedPlan as any)?.companyLogo?.url ||
            (typeof (step1Data?.selectedPlan as any)?.companyLogo === "string"
              ? (step1Data?.selectedPlan as any)?.companyLogo
              : "") ||
            ""
          }
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={
            (step1Data?.selectedPlan as any)?.appointmentLink || ""
          }
          benefitTitle={step1Data?.benefitTitle || ""}
          categoryBenefitByApi={step1Data?.categoryBenefitByApi ?? null}
          onSubmit={handleContactSubmitted}
        />



        {/* T4: scoped to the plan and the category this step is editing. The same
            step renders in the Create (section undefined) and Edit
            (section="contacts") benefit flows, so the audit row records which. */}
        <InviteCollaboratorDialog
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          planId={invitePlanId}
          planName={step1Data?.selectedPlan?.companyName || "this plan"}
          category={inviteCategory}
          source={section === "contacts" ? "edit_benefit" : "create_benefits"}
          onInvited={() => setCollaboratorsRefreshKey((key) => key + 1)}
        />

        {/* Promote one Support Contact into a paid Team Member seat. A different
            action from the invite above on purpose: a Collaborator is free and
            external, a Team Member consumes a seat and shows up in Settings → People
            & Access. `onGranted` re-reads the assignee list, because the new Team
            Member now holds an assignment on this plan. */}
        <GiveTeamSeatDialog
          contact={contactPendingSeat}
          onOpenChange={(open) => {
            if (!open) setContactPendingSeat(null);
          }}
          onGranted={() => setCollaboratorsRefreshKey((key) => key + 1)}
          currentCustomBenefit={currentCustomBenefit}
          // The plan this benefit belongs to: the invitation email names it, so the
          // recipient reads "added you to <Plan> on PlanTelligence".
          planId={invitePlanId || null}
        />

        {/* Plan-level delete confirmation. Placed here for locality only — Radix's
            AlertDialog portals to `document.body`, so tree position doesn't affect
            stacking. */}
        <ConfirmDialog
          open={!!contactPendingDelete}
          onOpenChange={(open) => {
            if (!open && !isDeletingContact) setContactPendingDelete(null);
          }}
          onConfirm={async () => {
            if (contactPendingDelete) await deleteContact(contactPendingDelete);
            setContactPendingDelete(null);
          }}
          title="Delete this contact from the plan?"
          description={`${
            contactPendingDelete?.name ||
            `${contactPendingDelete?.firstName ?? ""} ${
              contactPendingDelete?.lastName ?? ""
            }`.trim() ||
            "This contact"
          } will be removed from the plan's contact list, so it disappears from every benefit — not just this one. This cannot be undone.`}
          confirmText="Yes, delete"
          cancelText="No, keep"
          variant="destructive"
          isLoading={isDeletingContact}
          loadingText="Deleting..."
        />

        {/* FAQ Section — an accordion block of its own, in the same language as the
            Contacts sections above. Each question keeps its own expand/collapse (still
            driven by `expandedId`, not by this accordion), so opening the section reveals
            the list and opening a question reveals its fields. */}
        {(!section || section === "faqs") && (
        <Accordion
          type="multiple"
          value={openFaqSection}
          onValueChange={setOpenFaqSection}
          className="space-y-4"
        >
          <AccordionItem
            value="faqs"
            className="rounded-xl border bg-card shadow-md"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
                <HelpCircle className="w-5 h-5 shrink-0 text-accent-blue" />
                <span className="text-lg font-bold text-foreground">
                  Popular Questions (FAQ)
                </span>
                <Badge variant="secondary" className="font-medium">
                  {resolvedFaqs.length}
                </Badge>
                {/* The actions stay in the header, where they were. Their events are
                    stopped at this wrapper rather than on each button: the header is the
                    accordion's trigger, so without it saving an FAQ would also collapse
                    the section being saved. */}
                <span
                  className="flex shrink-0 flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Button
                    onClick={() => setPreviewOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs font-semibold"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </Button>
                  <Button
                    onClick={handleSaveFaqs}
                    variant="default"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs font-semibold"
                    disabled={savePending}
                  >
                    {savePending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savePending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    onClick={addFaq}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-3 text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </Button>
                </span>
                <span className="w-full text-xs font-normal text-muted-foreground">
                  Manage frequently asked questions for this benefit — drag the handle to
                  reorder, and each question opens on its own.
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-0">
            <CardContent className="p-3">
            {resolvedFaqs.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
                <HelpCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">
                  No questions added yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={resolvedFaqs.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {resolvedFaqs.map((faq, index) => (
                      <SortableFaqItem
                        key={faq.id}
                        faq={faq}
                        index={index}
                        expandedId={expandedId}
                        toggleExpand={toggleExpand}
                        updateFaq={updateFaq}
                        removeFaq={removeFaq}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
            </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        )}

      </div>

      {/* FAQ Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>FAQ Preview</DialogTitle>
            <DialogDescription>
              This is how the FAQ section will appear on the portal.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            {previewFaqs.length > 0 ? (
              <div>
                <FAQSection
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                  faqs={previewFaqs}
                  contacts={previewContacts}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No enabled FAQs to preview.</p>
                <p className="text-xs mt-1">Add questions above and ensure they are enabled.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Support Contacts preview — the portal's own "Have Questions?" cards, fed the
          same `previewContacts` the FAQ preview above already builds, so the two cannot
          disagree about who employees will be shown (and with what details). */}
      <Dialog open={contactsPreviewOpen} onOpenChange={setContactsPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Support Contacts Preview</DialogTitle>
            <DialogDescription>
              The portal shows these cards in its Have Questions section, exactly as
              the selections above define them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-white">
            {previewContacts && previewContacts.length > 0 ? (
              <HaveQuestions
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                contacts={previewContacts}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No support contacts to preview.</p>
                <p className="text-xs mt-1">
                  Select the contacts employees should reach out to above.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SortableFaqItemProps {
  faq: FAQItem;
  index: number;
  expandedId: string | null;
  toggleExpand: (id: string) => void;
  updateFaq: (id: string, updates: Partial<FAQItem>) => void;
  removeFaq: (id: string) => void;
}

const MAX_ANSWER_LENGTH = 500;

function SortableFaqItem({
  faq,
  index,
  expandedId,
  toggleExpand,
  updateFaq,
  removeFaq,
}: SortableFaqItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    position: isDragging ? ("relative" as const) : ("static" as const),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "shadow-2xl ring-2 ring-accent-blue/20" : ""}`}
    >
      <div className="border rounded-lg bg-white overflow-hidden transition-all duration-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <div
          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors ${expandedId === faq.id
            ? "bg-gray-50/50 border-b border-gray-100 dark:bg-gray-700/40 dark:border-gray-700"
            : ""
            }`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={() => toggleExpand(faq.id)}
        >
          <div className="flex items-center gap-2.5 flex-1 overflow-hidden">
            <div
              {...attributes}
              {...listeners}
              className="p-1 -ml-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue/10 text-accent-blue font-bold text-[10px] shrink-0">
              {index + 1}
            </div>
            <span
              className={`text-sm truncate transition-colors ${expandedId === faq.id
                ? "text-accent-blue font-semibold"
                : "text-foreground"
                }`}
            >
              {faq.question || `Question ${index + 1}`}
            </span>
          </div>
          <div
            className="flex items-center gap-2.5 ml-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={faq.enabled}
              onCheckedChange={(checked) =>
                updateFaq(faq.id, { enabled: checked })
              }
              className="scale-[0.65]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 h-6 w-6"
              onClick={() => removeFaq(faq.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 dark:text-neutral-500 transition-transform duration-300 ${expandedId === faq.id ? "rotate-180" : ""
                }`}
            />
          </div>
        </div>

        <AnimatePresence>
          {expandedId === faq.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="px-3 py-4 space-y-4 bg-white dark:bg-gray-800">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Question Text
                  </Label>
                  <Input
                    value={faq.question}
                    onChange={(e) =>
                      updateFaq(faq.id, { question: e.target.value })
                    }
                    placeholder="Enter question..."
                    className="h-8 text-xs font-medium text-foreground border-gray-200 focus:border-accent-blue dark:border-gray-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Answer
                  </Label>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length <= MAX_ANSWER_LENGTH) {
                        updateFaq(faq.id, { answer: val });
                      }
                    }}
                    placeholder="Enter answer..."
                    maxLength={MAX_ANSWER_LENGTH}
                    className="min-h-[80px] text-xs leading-relaxed border-gray-200 focus:border-accent-blue dark:border-gray-600"
                  />
                  <div className="flex justify-end">
                    <span
                      className={`text-[11px] font-medium tabular-nums transition-colors duration-200 ${
                        faq.answer.length >= MAX_ANSWER_LENGTH
                          ? "text-red-500"
                          : faq.answer.length >= MAX_ANSWER_LENGTH * 0.9
                            ? "text-amber-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      {faq.answer.length.toLocaleString()}
                      <span className="text-muted-foreground/60">
                        /{MAX_ANSWER_LENGTH.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Link Label
                    </Label>
                    <Input
                      value={faq.linkLabel}
                      onChange={(e) =>
                        updateFaq(faq.id, { linkLabel: e.target.value })
                      }
                      placeholder="Learn More"
                      className="h-8 text-[11px] border-gray-200 focus:border-accent-blue dark:border-gray-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Link URL
                    </Label>
                    <Input
                      value={faq.linkHref}
                      onChange={(e) =>
                        updateFaq(faq.id, { linkHref: e.target.value })
                      }
                      placeholder="https://..."
                      className="h-8 text-[11px] border-gray-200 focus:border-accent-blue dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
