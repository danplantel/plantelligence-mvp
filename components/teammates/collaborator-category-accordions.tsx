"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollaboratorCard } from "./collaborator-card";
import type { CollaboratorDetailPerson } from "./collaborator-detail-dialog";

/**
 * One benefit category the collaborators are grouped by.
 *
 * Deliberately NOT "External HR / Administrator": a collaborator is an external person
 * helping with a benefit's content, and nobody is invited to collaborate on the external
 * HR contact — so that group is left out of this set the same way the Contacts lists would
 * be if they had nothing to put in it.
 */
export interface CollaboratorCategoryGroup {
  /** Matched against an assignment's `categories` (case/whitespace-insensitive). */
  id: string;
  label: string;
  icon: ReactNode;
  /**
   * Extra stored values this group also collects.
   *
   * A Custom benefit is stored under the **"Company / Plan Sponsor"** key — the Custom
   * hub's — with the advisor's own name for the benefit written beside it. The Custom
   * group therefore matches that key (and there is no "Company / Plan Sponsor" group:
   * nobody is invited to collaborate on the plan-sponsor contact itself).
   */
  match?: string[];
  /**
   * What the group's "Add" pre-selects in the invite. Defaults to `id`; the Custom group
   * uses the benefit's own name so the invite ticks the named benefit, not the hub key.
   */
  prefill?: string;
}

export interface CollaboratorCategoryAccordionsProps {
  /** Already filtered to collaborators — the caller drops `team_member` rows. */
  collaborators: CollaboratorDetailPerson[];
  /** Ordered groups, WITHOUT External HR. */
  categories: CollaboratorCategoryGroup[];
  /** Open the invite dialog scoped to this category. */
  onAddToCategory: (categoryId: string) => void;
  onOpen: (person: CollaboratorDetailPerson) => void;
  onEdit: (person: CollaboratorDetailPerson) => void;
  onDelete?: (person: CollaboratorDetailPerson) => void;
  onResendInvite?: (person: CollaboratorDetailPerson) => void;
  resendingProfileId?: string | null;
  /** Overrides the per-category empty line. */
  emptyLabel?: (label: string) => string;
}

/**
 * A collaborator sits in a category when the assignment is scoped to all of them, or
 * names that one. Mirrors how a Key Contact lands in several category accordions when its
 * `benefitsCategories` lists more than one, so the two lists read the same way.
 */
function inCategory(
  person: CollaboratorDetailPerson,
  group: CollaboratorCategoryGroup,
): boolean {
  if (person.categoryScope === "all") return true;
  const targets = [group.id, ...(group.match ?? [])].map((value) =>
    value.trim().toLowerCase(),
  );
  return person.categories.some((value) =>
    targets.includes(value.trim().toLowerCase()),
  );
}

/**
 * The Collaborators list, split into one accordion per benefit category — the same
 * grouping the Contacts above it use, minus External HR.
 *
 * Shared by Edit Client's Contacts tab and Create Plan's Key Contacts step so the two
 * cannot drift: same categories, same cards, same actions. The caller owns the data and
 * the actions; this only groups, labels and lays out.
 *
 * Every accordion that holds somebody opens on first render with data, so a roster that
 * arrived from the API is not hidden behind five collapsed headers. The user keeps full
 * control afterwards — the open set is state, and the effect runs once.
 */
export function CollaboratorCategoryAccordions({
  collaborators,
  categories,
  onAddToCategory,
  onOpen,
  onEdit,
  onDelete,
  onResendInvite,
  resendingProfileId = null,
  emptyLabel,
}: CollaboratorCategoryAccordionsProps) {
  const [open, setOpen] = useState<string[]>([]);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current || collaborators.length === 0) return;
    initialised.current = true;
    setOpen(
      categories
        .filter((group) =>
          collaborators.some((person) => inCategory(person, group)),
        )
        .map((group) => group.id),
    );
  }, [collaborators, categories]);

  return (
    <Accordion
      type="multiple"
      className="space-y-3"
      value={open}
      onValueChange={setOpen}
    >
      {categories.map((group) => {
        const people = collaborators.filter((person) =>
          inCategory(person, group),
        );
        return (
          <AccordionItem
            key={group.id}
            value={group.id}
            className="rounded-xl border bg-card shadow-sm"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                {group.icon}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {people.length}
                </Badge>
                <span className="text-base font-semibold">{group.label}</span>
              </div>
              {/* The invite belongs to the category it adds to, and its events are
                  stopped so pressing it never also collapses the section. */}
              <Button
                size="sm"
                variant="ghost"
                className="mr-2 shrink-0"
                aria-label={`Add a collaborator to ${group.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onAddToCategory(group.prefill ?? group.id);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-3">
              {people.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {emptyLabel
                    ? emptyLabel(group.label)
                    : `No collaborators assigned to ${group.label}.`}
                </p>
              ) : (
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {people.map((person) => (
                    <CollaboratorCard
                      key={`${group.id}:${person.assignmentId}`}
                      person={person}
                      onOpen={() => onOpen(person)}
                      onEdit={() => onEdit(person)}
                      onDelete={onDelete ? () => onDelete(person) : undefined}
                      onResendInvite={
                        onResendInvite &&
                        !person.deactivatedAt &&
                        person.state === "invited"
                          ? () => onResendInvite(person)
                          : undefined
                      }
                      resending={resendingProfileId === person.profileId}
                    />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
