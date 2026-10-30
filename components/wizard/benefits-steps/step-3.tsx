"use client";

import { useEffect, useMemo, useState } from "react";
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
  type TeammateAssignmentRole,
  type TeammatePersonType,
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
// The plan's Key Contacts card — the SAME card the Edit Client and Create Plan
// Key Contacts surfaces render, so this roster cannot drift from them.
import { ContactCard } from "@/components/contacts/contact-card";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BenefitContactDialog } from "./benefit-contact-dialog";
import { GiveTeamSeatDialog } from "./give-team-seat-dialog";
import { invalidateClientCache } from "@/lib/fetch-client";
import { persistBenefitSupportContacts } from "@/lib/persist-benefit-support-contacts";
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
import {
  FAQSection,
  DynamicFAQItem,
  FAQContact,
} from "@/components/faq-section";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import {
  CollaboratorDetailDialog,
  type CollaboratorDetailPerson,
} from "@/components/teammates/collaborator-detail-dialog";
import { CollaboratorCard } from "@/components/teammates/collaborator-card";
import { useViewerAccess } from "@/hooks/useViewerAccess";
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
  /** The seat's own details, shown on the card — see `PlanAssignmentRow`. */
  jobTitle?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  /**
   * `team_member` for anyone who holds a paid seat (or an invitation that reserves one),
   * `collaborator` for the free external people this section is about. The API has always
   * returned it; the section needs it to keep its own promise — see `planCollaborators`.
   */
  personType: TeammatePersonType;
  companyName: string | null;
  role: TeammateAssignmentRole;
  categoryScope: "all" | "selected";
  categories: string[];
  state: TeammateProfileState;
  deactivatedAt: string | null;
  inviteDueDate: string | null;
  /**
   * Set when the person deleted their OWN login and an Owner or Admin has not yet accepted it.
   *
   * `DELETE /api/profile/delete` flags the profile instead of removing it — their access is
   * deliberately left in place — so on this card it means "they asked to go; somebody here has
   * to confirm". Carried by `/api/teammates/plan-assignments` (see `PlanAssignmentRow`).
   */
  selfDeletedAt?: string | null;
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
 * Caps for a Support Contact's portal copy.
 *
 * These two fields are what employees read on the benefit page's "Have Questions?" card,
 * so the limits are set by what fits that card rather than by the database: a title is a
 * short role label and a description is one or two lines beside it. Enforced on the
 * inputs (with a counter) so an overlong value cannot be typed in the first place, the
 * same way the FAQ answer is capped by `MAX_ANSWER_LENGTH`.
 */
const MAX_SUPPORT_CONTACT_TITLE_LENGTH = 30;
const MAX_SUPPORT_CONTACT_DESCRIPTION_LENGTH = 100;

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

/**
 * The Collaborators placeholder, shown while the plan's assignments are being read.
 *
 * Without it the section rendered its EMPTY state — a 0 badge and "No collaborators yet" — for the
 * couple of seconds that read takes, which is a claim about the plan made while the answer is still
 * in flight. That is the same mistake the Support Contacts cards above were fixed for, and it reads
 * worse here: "none" is exactly what an advisor would believe, and a collaborator is the one thing
 * on this step that can still arrive.
 *
 * Four cards, because that is what one row holds (`lg:grid-cols-4`), each mirroring the real card's
 * boxes — avatar row, detail block, status chip — so the reveal is a fade rather than a relayout.
 * The detail block is FOUR lines for that reason: the real card always draws name, title, email and
 * phone, so a three-line placeholder would move the page when it resolved.
 */
function CollaboratorCardsSkeleton() {
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
            <div className="space-y-0.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
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
  // Add contact (plan-level): the SAME shared editor, in create mode.
  const [isAddingContact, setIsAddingContact] = useState(false);
  // "Give Team Seat": the contact the seat confirm dialog is asking about. Deliberately
  // separate from `editingContact` — editing the person and giving them a paid seat are
  // different questions, and one dialog must never answer for the other.
  const [contactPendingSeat, setContactPendingSeat] =
    useState<KeyContact | null>(null);
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
  // The Collaborator whose detail modal is open (opened by clicking their row).
  const [selectedCollaborator, setSelectedCollaborator] =
    useState<CollaboratorDetailPerson | null>(null);
  // The Collaborator whose removal is awaiting confirmation, and whether it is in flight.
  const [collaboratorPendingDelete, setCollaboratorPendingDelete] =
    useState<CollaboratorDetailPerson | null>(null);
  const [isDeletingCollaborator, setIsDeletingCollaborator] = useState(false);
  /**
   * The Collaborator whose invitation is being re-sent.
   *
   * Held by id rather than as a boolean so only THAT card swaps its icon for a spinner — the
   * section lists several people and a shared flag would put every card in a loading state.
   */
  const [resendingProfileId, setResendingProfileId] = useState<string | null>(
    null,
  );
  /**
   * The Collaborator whose OWN account deletion is awaiting confirmation, and whether that
   * PATCH is in flight.
   *
   * Deliberately a separate state from `collaboratorPendingDelete` above: that one removes a
   * person from THIS plan, while this one accepts the `selfDeletedAt` marker and removes them
   * from the whole organization — every plan they are on, seat included.
   */
  const [confirmingSelfDeletion, setConfirmingSelfDeletion] =
    useState<CollaboratorDetailPerson | null>(null);
  const [isConfirmingSelfDeletion, setIsConfirmingSelfDeletion] =
    useState(false);
  // Owner/Admin only: whether the seat grant is offered at all. The API enforces it too.
  const { canManageTeam } = useViewerAccess();
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
  /**
   * Whether the assignments have EVER been read.
   *
   * Deliberately not `seatStatusResolved`, which goes back to false on every run — including the
   * refresh after an invite — because the seat ladder must stop offering a seat the moment one is
   * granted. The LIST must not go back with it: blanking rows the advisor is already reading, in
   * order to draw the same rows again a second later, is a blink rather than feedback. So the
   * placeholder is tied to "never loaded", and a refresh leaves the current rows on screen while
   * the new ones arrive. Same distinction as `contactsResolved` above.
   */
  const [collaboratorsLoaded, setCollaboratorsLoaded] = useState(false);
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
      // Nothing to wait for: without a plan there are no seats to look up, and — for the list's
      // placeholder — nothing to wait for either. The empty state is the honest answer here.
      setSeatStatusResolved(true);
      setCollaboratorsLoaded(true);
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
          `/api/teammates/plan-assignments?planId=${encodeURIComponent(
            invitePlanId,
          )}`,
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
        if (!cancelled) {
          setSeatStatusResolved(true);
          // Sticky, so this only ever takes the placeholder away.
          setCollaboratorsLoaded(true);
        }
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

  /**
   * The people the Collaborators section lists: everyone assigned to this plan who does NOT
   * hold a Team Member seat.
   *
   * Giving a Support Contact a seat ("Give Team Seat") grants that person plan access right
   * away, and this section renders the plan's assignments — so the person the seat was just
   * given to appeared here too, listed a second time and described as free external help
   * ("no seat, and no publish, invite, delete or organization settings") while in fact holding
   * a paid seat. `personType` is what separates the two kinds of row, and it is what lets the
   * section honour the promise in its own heading.
   *
   * Seat holders are not hidden anywhere: their home is Settings → People & Access, and their
   * Support Contact card above already says "Team member" or "Invite sent".
   *
   * `teammateByEmail` above deliberately reads the UNFILTERED list: it answers "does this
   * contact already hold a seat or an invitation", which is exactly the rows removed here.
   */
  const planCollaborators = useMemo(
    () =>
      collaborators.filter(
        (person) =>
          person.personType !== "team_member" &&
          // A Key Contact is NOT a Collaborator. The T7 contact mirror creates a
          // `contact`-state profile (no login, no seat) and a Viewer assignment for the
          // Benefits Hub to render from. `personType` alone would list that mirrored row
          // here — which is why creating a Key Contact made them appear in this section.
          // Invited/active collaborators still have `state: "invited" | "active"`.
          person.state !== "contact",
      ),
    [collaborators],
  );

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

  if (process.env.NODE_ENV === "development") {
    // console.log("[Step 3] planContacts:", planContacts, "planId:", step1Data?.planId);
  }

  // Helper: get the latest faqsByCategory map directly from the Zustand store.
  // Reads the authoritative state to avoid stale closure issues.
  const readFaqsByCategory = (): Record<string, FAQItem[]> => {
    return (
      useBenefitsWizardStore.getState().stepData.step3?.faqsByCategory ?? {}
    );
  };

  // Derive the correct FAQ list for the current benefit category — computed on
  // every render. Retirement defaults are shown as a single combined list.
  const resolvedFaqs = ((): FAQItem[] => {
    const cat = step1Data?.benefitCategory;
    if (!cat) return [];
    const saved = readFaqsByCategory()[cat];
    let list: FAQItem[] =
      saved && saved.length > 0 ? saved : DEFAULT_FAQS[cat] ?? [];
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
    const latestStep3 = useBenefitsWizardStore.getState().stepData.step3 || {
      faqs: [],
      supportContacts: [],
      currentSubStep: "a",
    };
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
      const oldIndex = resolvedFaqs.findIndex((f) => f.id === active.id);
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
      toast.error(
        "Missing plan or category data. Please complete Step 1 first.",
      );
      return;
    }

    setSavePending(true);
    try {
      // Normalize "Custom" → "Company / Plan Sponsor" for the API
      const category =
        benefitCategory === "Custom"
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
      if (!updateResult.success)
        throw new Error(updateResult.error || "Failed to save FAQs");

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

  /**
   * Write this benefit's support-contacts selection to its Benefit row NOW.
   *
   * The plan-level roster (`Client.keyContacts`) is saved the moment a contact is
   * created, edited or deleted, but the benefit's own selection used to wait for the
   * page's Save. That left the two participant surfaces disagreeing: My Benefits Team
   * (which reads the plan roster) showed the person the advisor had just added, while
   * the hub's "Have Questions?" (which reads `Benefit.supportContacts`) kept showing
   * the old list — the selection only landed once the benefit itself was saved.
   *
   * See `lib/persist-benefit-support-contacts` for the write itself.
   */
  const persistSupportContacts = (contactsForBenefit: SupportContact[]) => {
    void persistBenefitSupportContacts({
      planId: step1Data?.planId,
      category: step1Data?.benefitCategory,
      supportContacts: contactsForBenefit,
    });
  };

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
      // The hub must stop showing this person now, not at the next Save.
      persistSupportContacts(newContacts);
    } else {
      // The cap is enforced here as well as in the row styling: two fast clicks must
      // not slip a fifth contact past a stale render.
      const liveCount =
        useBenefitsWizardStore.getState().stepData.step3?.supportContacts
          .length ?? 0;
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
        // No boilerplate: the card's subtitle is the person's job title, and an
        // empty value lets the resolver read it from the contact.
        description: "",
        enabled: true,
      };
      const nextContacts = [
        ...currentStep3Data.supportContacts,
        newContact,
      ];
      saveStepData(3, {
        ...currentStep3Data,
        ...supportContactsContext,
        supportContacts: nextContacts,
      });
      // The hub must show this person now, not at the next Save.
      persistSupportContacts(nextContacts);
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
    // `enabled` lives here too, and a disabled person is dropped from the hub.
    persistSupportContacts(newContacts);
  };

  // Map FAQs and contacts for preview
  const previewFaqs: DynamicFAQItem[] = useMemo(
    () =>
      resolvedFaqs
        .filter((f) => f.enabled && f.question && f.answer)
        .map((f) => ({
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
        const remainingSupportContacts = step3.supportContacts.filter(
          (sc) => sc.contactId !== contactId,
        );
        saveStepData(3, {
          ...step3,
          ...supportContactsContext,
          supportContacts: remainingSupportContacts,
        });
        // The hub reads the Benefit row, not the plan roster — drop the card there
        // too, now, rather than at the next Save.
        persistSupportContacts(remainingSupportContacts);
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
   * Remove a Collaborator from this plan.
   *
   * `DELETE /api/teammates/assignments/:id` is the module's own writer (spec T6 item 1):
   * the person keeps their profile but loses access to this plan and its categories at
   * once, and the change is audited. `collaboratorsRefreshKey` re-reads the list — the
   * delete touches an assignment, not a contact, so `deleteContact` above is not it.
   */
  const deleteCollaboratorFromPlan = async (
    person: CollaboratorDetailPerson,
  ) => {
    setIsDeletingCollaborator(true);
    try {
      const response = await fetch(
        `/api/teammates/assignments/${encodeURIComponent(person.assignmentId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error ?? "Could not remove the collaborator");
        return;
      }
      toast.success(`${person.name} was removed from this plan.`);
      // If their detail modal is open, it now describes someone off the plan.
      setSelectedCollaborator((current) =>
        current?.assignmentId === person.assignmentId ? null : current,
      );
      setCollaboratorsRefreshKey((key) => key + 1);
    } catch {
      toast.error("Could not remove the collaborator");
    } finally {
      setIsDeletingCollaborator(false);
    }
  };

  /**
   * Re-deliver a pending collaborator's invitation.
   *
   * The same `resend_invite` action the other collaborator lists use, so all four surfaces
   * behave identically. A resend is a DELIVERY retry rather than a new grant: the link is minted
   * from `invitedAt`, so an open invitation goes out again with the same link and the same
   * window. Only a LAPSED hold starts a new one, and the server owns that decision — here it is
   * one call either way.
   *
   * A mail failure is reported rather than treated as a failed action: the invitation is still
   * open, and what the advisor needs is the reason, not another error.
   */
  const resendCollaboratorInvite = async (person: CollaboratorDetailPerson) => {
    setResendingProfileId(person.profileId);
    try {
      const response = await fetch(
        `/api/teammates/team/${encodeURIComponent(person.profileId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resend_invite" }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        emailSent?: boolean;
        emailError?: string | null;
        member?: { expiresInDays?: number; refreshedWindow?: boolean };
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not resend the invitation");
        return;
      }
      // The days the emailed link actually has left, which is not always fourteen: a resend of an
      // open invitation reports the REMAINDER, and a refreshed one reports the new window. The
      // copy is built from the server's number so the toast cannot promise a longer hold than the
      // email just did.
      const days = body.member?.expiresInDays;
      const windowNote =
        typeof days === "number"
          ? body.member?.refreshedWindow
            ? ` A fresh invitation was issued and expires in ${days} day${
                days === 1 ? "" : "s"
              }.`
            : ` Their invitation has ${days} day${days === 1 ? "" : "s"} left.`
          : "";
      if (body.emailSent) {
        toast.success(`Invitation re-sent to ${person.email}.${windowNote}`);
        // Same refresh the invite and the removal use, so the card's expiry line re-reads.
        setCollaboratorsRefreshKey((key) => key + 1);
      } else {
        toast.warning(
          body.emailError
            ? `Could not send the invitation: ${body.emailError}`
            : "The invitation was not sent.",
        );
      }
    } catch {
      toast.error("Could not resend the invitation");
    } finally {
      setResendingProfileId(null);
    }
  };

  /**
   * Accept a Collaborator's own account deletion.
   *
   * `DELETE /api/profile/delete` flags the profile `selfDeletedAt` and deliberately leaves the
   * person's access alone, because a login holder must not be able to empty an organization's
   * roster on their own. The marker is what puts the person on this card; this handler is the
   * advisor's half of the pair. `confirmSelfDeletedProfile` refuses a profile that was not
   * self-deleted, so this is not a second route to removal.
   *
   * The person leaves EVERY plan they were on, not just the one this step edits, so the list is
   * re-read rather than patched locally — the server knows which rows went.
   */
  const confirmCollaboratorSelfDeletion = async (
    person: CollaboratorDetailPerson,
  ) => {
    setIsConfirmingSelfDeletion(true);
    try {
      const response = await fetch(
        `/api/teammates/team/${encodeURIComponent(person.profileId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_self_deletion" }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not confirm the deletion");
        return;
      }
      toast.success(`${person.name} was removed from your organization.`);
      // Their detail modal, if open, now describes somebody who is gone.
      setSelectedCollaborator((current) =>
        current?.profileId === person.profileId ? null : current,
      );
      setCollaboratorsRefreshKey((key) => key + 1);
    } catch {
      toast.error("Could not confirm the deletion");
    } finally {
      setIsConfirmingSelfDeletion(false);
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

  /**
   * Persist a contact the shared editor CREATED, then select it for this benefit.
   *
   * Written to the plan first for the same reason `handleContactSubmitted` is: the
   * contact list is the plan's, and `saveBenefit` merges `keyContacts` starting FROM
   * the stored rows, so a person who only existed in local state would be dropped on
   * the next save. Selecting them here is what makes the new card appear on this
   * benefit — the section the advisor was looking at when they noticed the gap — and
   * the per-benefit cap is respected rather than bypassed.
   */
  const handleContactCreated = async (created: KeyContact) => {
    const planId = step1Data?.planId;
    if (!planId) throw new Error("No plan selected");

    const nextContacts = [...localContacts, created];

    const res = await fetch(`/api/clients/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyContacts: nextContacts }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) {
      throw new Error(
        result?.error || `Failed to add the contact (${res.status})`,
      );
    }

    // The plan row changed — the shared cache must not serve the old copy.
    invalidateClientCache(planId);
    setLocalContacts(nextContacts);

    // Keep the store's copy of the plan in step, because `saveBenefit` merges FROM
    // `selectedPlan.keyContacts`.
    const latest = useBenefitsWizardStore.getState().stepData.step1;
    if (latest && latest.planId === planId) {
      const selectedPlan = latest.selectedPlan
        ? { ...(latest.selectedPlan as any), keyContacts: nextContacts }
        : latest.selectedPlan;
      saveStepData(1, { ...latest, selectedPlan });
    }

    // Select them for this benefit when the cap allows it. Read the live store rather
    // than the render's snapshot so two quick adds cannot slip past the limit.
    const liveStep3 = useBenefitsWizardStore.getState().stepData.step3 ?? {
      faqs: [],
      supportContacts: [],
      currentSubStep: "a",
    };
    const liveSupportContacts = liveStep3.supportContacts || [];
    if (!canAddSupportContact(liveSupportContacts.length)) {
      toast.success("Contact added to the plan", {
        description: `This benefit already shows ${MAX_SUPPORT_CONTACTS_PER_BENEFIT} support contacts — deselect one to include them here.`,
      });
      return;
    }

    const newSupportContact: SupportContact = {
      contactId: created.id,
      title: created.title || "Support Contact",
      // No boilerplate — see the note on `newContact` above.
      description: "",
      enabled: true,
    };
    const nextSupportContacts = [...liveSupportContacts, newSupportContact];
    saveStepData(3, {
      ...liveStep3,
      ...supportContactsContext,
      supportContacts: nextSupportContacts,
    });
    // The person is already on the plan roster, which My Benefits Team reads; write
    // this benefit's selection too, so the hub's cards include them immediately.
    persistSupportContacts(nextSupportContacts);
    toast.success("Contact added and selected for this benefit");
  };

  const previewContacts: FAQContact[] | undefined = useMemo(() => {
    const enabled = currentStep3Data.supportContacts.filter((sc) => sc.enabled);
    if (enabled.length === 0) return undefined;
    return enabled.map((sc) => {
      const matched = planContacts.find((c) => c.id === sc.contactId);
      const personName =
        sc.title ||
        matched?.name ||
        `${matched?.firstName ?? ""} ${matched?.lastName ?? ""}`.trim() ||
        "Support Contact";
      return {
        id: sc.contactId,
        // The card shows the name and, under it, the role.
        name: personName,
        title: personName,
        // The person's role, matching My Benefits Team. The per-benefit blurb is
        // only a fallback — it used to win and every card read the same sentence.
        description:
          matched?.customRole || matched?.title || sc.description || "",
        email: matched?.email || "",
        phone: matched?.phone || "",
        phoneExtension: matched?.phoneExtension,
        headshot: matched?.headshot || undefined,
        // The pills the advisor gave this contact, so the "Have Questions?" preview
        // shows the same card the portal will.
        designations: matched?.designations,
        // Everything the shared card renders a button or logo from — copied
        // verbatim so the preview cannot invent what the portal would not show.
        schedulingUrl: matched?.schedulingUrl,
        companyName: matched?.companyName,
        companyLogo: matched?.companyLogo,
        websiteUrl: matched?.websiteUrl,
        enableContactButton: matched?.enableContactButton,
        contactButtonType: matched?.contactButtonType,
        // Which categories the person serves, so a Company / Plan Sponsor card
        // can borrow the plan's logo exactly as it does on the live hub.
        benefitsCategories: matched?.benefitsCategories,
      } as FAQContact;
    });
  }, [currentStep3Data.supportContacts, planContacts]);

  const brandColor =
    step1Data?.selectedPlan?.brandColor ||
    step1Data?.selectedPlan?.brandColors?.primary ||
    "#1F3A60";
  const secondaryColor =
    step1Data?.selectedPlan?.secondaryColor ||
    step1Data?.selectedPlan?.brandColors?.secondary ||
    "#6B7280";
  /** The plan's own logo — what a Company / Plan Sponsor card shows. */
  const planCompanyLogoUrl =
    (step1Data?.selectedPlan as any)?.companyLogo?.url ||
    (typeof (step1Data?.selectedPlan as any)?.companyLogo === "string"
      ? (step1Data?.selectedPlan as any)?.companyLogo
      : "") ||
    "";

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
              <h2 className="text-lg font-bold text-foreground">
                Contacts & FAQs
              </h2>
              <p className="text-xs text-muted-foreground">
                Who employees reach out to, and who can help complete this
                section.
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
                      {selectedSupportCount} of{" "}
                      {MAX_SUPPORT_CONTACTS_PER_BENEFIT}
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
                    {/* Add a contact to the PLAN from here. The roster comes from Step 1,
                  but that is a long way back for one missing person — and the section
                  is where the gap is noticed. Disabled without a plan, because the
                  save writes the plan's own contact list. */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold"
                      aria-label="Add a contact"
                      title={
                        step1Data?.planId
                          ? "Add a contact to this plan"
                          : "Save the plan first, then add a contact"
                      }
                      disabled={!step1Data?.planId}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddingContact(true);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Plus className="h-4 w-4" />
                      Add Contact
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
                          <b>
                            up to {MAX_SUPPORT_CONTACTS_PER_BENEFIT} support
                            contacts
                          </b>{" "}
                          — these are the contact cards employees see on the
                          benefit page.{" "}
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
                          <p className="text-sm text-muted-foreground font-medium">
                            No support contacts available.
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Please add contacts in Step 1 or check your
                            connection.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 h-8 text-xs"
                            onClick={() =>
                              useBenefitsWizardStore.getState().goToStep(1)
                            }
                          >
                            Go to Step 1 Selection
                          </Button>
                        </div>
                      ) : (
                        planContacts.map((contact) => {
                          const isSelected =
                            currentStep3Data.supportContacts.some(
                              (sc) => sc.contactId === contact.id,
                            );
                          // At the cap a contact that is not already selected cannot be
                          // added. Dim it so the rule is visible before the click —
                          // `toggleContact` still guards, and says why.
                          const isBlockedByLimit =
                            !isSelected && atSupportContactLimit;
                          // Email is the only key the plan's contact list and the assignment list
                          // share — a contact carries no profile id and a profile no contact id —
                          // so it is what connects this card to the person the server knows.
                          const contactEmail = (contact.email || "")
                            .trim()
                            .toLowerCase();
                          const teammate = contactEmail
                            ? teammateByEmail.get(contactEmail)
                            : undefined;
                          /**
                           * What the seat control below the card should say, or the seat
                           * button it offers. See the shared card's own ladder.
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
                            ? new Date(
                                teammate.inviteDueDate,
                              ).toLocaleDateString()
                            : null;

                          const personName =
                            contact.name ||
                            `${contact.firstName ?? ""} ${
                              contact.lastName ?? ""
                            }`.trim() ||
                            "Support Contact";

                          // The SAME card the plan's Key Contacts surfaces render
                          // (`ContactCard`): one identity block, one action cluster,
                          // one seat ladder. The whole card toggles this benefit's
                          // inclusion, and every action inside it stops propagation,
                          // so editing or deleting a person never deselects them.
                          return (
                            <div
                              key={contact.id}
                              role="button"
                              tabIndex={isBlockedByLimit ? -1 : 0}
                              aria-pressed={isSelected}
                              aria-label={
                                isSelected
                                  ? `Remove ${personName} from this benefit`
                                  : `Include ${personName} for this benefit`
                              }
                              title={
                                isBlockedByLimit
                                  ? `This benefit already shows ${MAX_SUPPORT_CONTACTS_PER_BENEFIT} support contacts — deselect one to include ${personName}.`
                                  : isSelected
                                  ? "Selected for this benefit — click to remove"
                                  : "Click to include this contact on the benefit page"
                              }
                              onClick={() => toggleContact(contact.id)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  toggleContact(contact.id);
                                }
                              }}
                              className={`rounded-xl transition-all ${
                                isSelected ? "ring-2 ring-accent-blue/50" : ""
                              } ${
                                isBlockedByLimit
                                  ? "cursor-not-allowed opacity-50"
                                  : "cursor-pointer"
                              }`}
                            >
                              <ContactCard
                                contact={contact}
                                seatStatus={seatStatus}
                                seatStatusResolved={seatStatusResolved}
                                inviteDueDate={inviteDueDate}
                                onEdit={() => setEditingContact(contact)}
                                onDelete={() =>
                                  setContactPendingDelete(contact)
                                }
                                onGiveSeat={
                                  contact.email
                                    ? () => setContactPendingSeat(contact)
                                    : undefined
                                }
                                actions={
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                      isSelected
                                        ? "border-accent-blue bg-accent-blue text-white"
                                        : "border-accent-blue bg-white dark:bg-gray-700"
                                    }`}
                                    aria-hidden
                                  >
                                    {isSelected && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </span>
                                }
                              />
                            </div>
                          );
                        })
                      )}
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
                    {/* A count is an answer, so it is only shown once there IS one. Until the first
                  read lands the badge holds its own space with a placeholder rather than reporting
                  0, which is a number the advisor would act on. */}
                    {collaboratorsLoaded ? (
                      <Badge variant="secondary" className="font-medium">
                        {planCollaborators.length}
                      </Badge>
                    ) : (
                      <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
                    )}
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
                      External people who help with this section. Free — no
                      seat, and no publish, invite, delete or organization
                      settings.
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="space-y-3">
                    {/* Unknown before empty — the order the Support Contacts grid above already uses,
                  and the reason `collaboratorsLoaded` exists rather than a length test. */}
                    {!collaboratorsLoaded ? (
                      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <CollaboratorCardsSkeleton />
                      </div>
                    ) : planCollaborators.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        No collaborators yet. Invite a plan sponsor, an outside
                        advisor or a provider rep to help fill in this section.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {planCollaborators.map((person) => (
                          <CollaboratorCard
                            key={person.assignmentId}
                            person={person}
                            onOpen={() => setSelectedCollaborator(person)}
                            onEdit={() => setSelectedCollaborator(person)}
                            onDelete={
                              canManageTeam
                                ? () => setCollaboratorPendingDelete(person)
                                : undefined
                            }
                            /* Offered only while the invitation is live and pending — the same gate the
                         other two collaborator lists apply, so a card never shows a retry the
                         server would refuse (already accepted, or a contact with no hold). It is
                         also Owner/Admin-only, like the removal above it: the endpoint requires
                         `org_settings`. */
                            onResendInvite={
                              canManageTeam &&
                              !person.deactivatedAt &&
                              person.state === "invited"
                                ? () => void resendCollaboratorInvite(person)
                                : undefined
                            }
                            /* They deleted their own login: until an Owner or Admin accepts it the
                         profile — and their access — is still here. Routed to a SEPARATE confirm
                         rather than the removal above, because they are asking to leave the
                         organization, not this one plan. Owner/Admin-only, like every other write
                         in this section. */
                            onConfirmDeletion={
                              person.selfDeletedAt && canManageTeam
                                ? () => setConfirmingSelfDeletion(person)
                                : undefined
                            }
                            resending={resendingProfileId === person.profileId}
                          />
                        ))}
                      </div>
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
          existingContacts={localContacts}
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

        {/* Add contact — the SAME editor the Edit button above opens, in create mode,
            so an advisor who spots a missing person does not have to leave for Step 1.
            The new contact is written to the plan (see handleContactCreated) and then
            selected for THIS benefit, so it appears on the card row straight away. */}
        <BenefitContactDialog
          open={isAddingContact}
          onOpenChange={setIsAddingContact}
          mode="create"
          planId={step1Data?.planId || ""}
          category={String(step1Data?.benefitCategory || "")}
          existingContacts={localContacts}
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
          onSubmit={handleContactCreated}
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

        {/* A Collaborator row opens this: who they are, plus — for an Owner or Admin —
            the ability to give them a Team seat on this organization. */}
        <CollaboratorDetailDialog
          person={selectedCollaborator}
          onOpenChange={(open) => {
            if (!open) setSelectedCollaborator(null);
          }}
          planId={invitePlanId || null}
          canManageSeats={canManageTeam}
          currentCustomBenefit={currentCustomBenefit}
          onGranted={() => setCollaboratorsRefreshKey((key) => key + 1)}
        />

        {/* Accepting a Collaborator's own deletion. A different action from the removal below:
            that one takes them off this plan, this one takes them out of the organization —
            every plan, seat included — and cannot be undone. Confirmed because the person is
            already gone from the product and the only thing left to decide is the cleanup. */}
        <ConfirmDialog
          open={!!confirmingSelfDeletion}
          onOpenChange={(open) => {
            if (!open && !isConfirmingSelfDeletion)
              setConfirmingSelfDeletion(null);
          }}
          onConfirm={async () => {
            if (confirmingSelfDeletion) {
              await confirmCollaboratorSelfDeletion(confirmingSelfDeletion);
            }
            setConfirmingSelfDeletion(null);
          }}
          title={
            confirmingSelfDeletion
              ? `Confirm ${confirmingSelfDeletion.name}'s deletion?`
              : ""
          }
          description={
            confirmingSelfDeletion
              ? `${confirmingSelfDeletion.name} deleted their own account. Confirming removes them from your organization along with their access to every plan they were assigned to. This cannot be undone.`
              : ""
          }
          confirmText="Yes, confirm"
          cancelText="Cancel"
          variant="destructive"
          isLoading={isConfirmingSelfDeletion}
          loadingText="Confirming..."
        />

        {/* Removing a Collaborator from the plan. Confirmed first because access ends
            immediately and re-inviting issues a new assignment rather than restoring
            this one. Radix portals the dialog, so position here is locality only. */}
        <ConfirmDialog
          open={!!collaboratorPendingDelete}
          onOpenChange={(open) => {
            if (!open && !isDeletingCollaborator)
              setCollaboratorPendingDelete(null);
          }}
          onConfirm={async () => {
            if (collaboratorPendingDelete) {
              await deleteCollaboratorFromPlan(collaboratorPendingDelete);
            }
            setCollaboratorPendingDelete(null);
          }}
          title="Remove this collaborator?"
          description={
            collaboratorPendingDelete
              ? `${collaboratorPendingDelete.name} will lose access to this plan and its benefit categories right away. You can invite them again later.`
              : ""
          }
          confirmText="Yes, remove"
          cancelText="No, keep"
          variant="destructive"
          isLoading={isDeletingCollaborator}
          loadingText="Removing..."
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
                    Manage frequently asked questions for this benefit — drag
                    the handle to reorder, and each question opens on its own.
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
                <p className="text-xs mt-1">
                  Add questions above and ensure they are enabled.
                </p>
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
              The portal shows these cards in its Have Questions section,
              exactly as the selections above define them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-white">
            {previewContacts && previewContacts.length > 0 ? (
              <HaveQuestions
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                contacts={previewContacts}
                companyLogo={planCompanyLogoUrl}
                // Label this benefit's key contact, exactly as the published hub
                // will. "Custom" is the wizard's name for the stored category.
                keyContacts={localContacts}
                category={
                  step1Data?.benefitCategory === "Custom"
                    ? "Company / Plan Sponsor"
                    : String(step1Data?.benefitCategory || "")
                }
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
          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors ${
            expandedId === faq.id
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
              className={`text-sm truncate transition-colors ${
                expandedId === faq.id
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
              className={`w-4 h-4 text-neutral-400 dark:text-neutral-500 transition-transform duration-300 ${
                expandedId === faq.id ? "rotate-180" : ""
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
