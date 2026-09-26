"use client";

/**
 * Compatibility shim.
 *
 * T5 originally owned this dialog here. It is now shared by four entry points (T4's
 * benefit card aside, this one serves Create Plan → Key Contacts, Edit Client's Key
 * Contacts tab, and Settings → Team Members), so the implementation moved to
 * [`@/components/teammates/invite-collaborator-dialog`](components/teammates/invite-collaborator-dialog.tsx).
 *
 * Nothing imports this path any more; it is kept only so a stale import in an
 * in-flight branch resolves to the same component instead of failing to build.
 */
export {
  InviteCollaboratorDialog,
  type InviteCollaboratorDialogProps,
  type InvitePlanChoice,
} from "@/components/teammates/invite-collaborator-dialog";
