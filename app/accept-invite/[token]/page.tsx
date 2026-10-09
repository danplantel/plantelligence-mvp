import { InviteAcceptForm } from "@/components/teammates/invite-accept-form";

/**
 * T9 — the invitee's landing page.
 *
 * Public by construction: this path is not in `middleware.ts`'s `APP_ROUTES` allow-list,
 * so an invited collaborator can reach it before they have any account at all. That is
 * the entire point — the invitation previously pointed at an authenticated dashboard
 * route, which is why nobody could ever accept one.
 *
 * Deliberately a thin server component: it hands the token to a client form and renders
 * nothing itself, so the invitation is fetched (and re-validated) on the client against
 * the live profile rather than being baked into HTML that might be stale.
 */
export default function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <main className="flex min-h-screen justify-center bg-muted/30 px-4 py-6">
      <InviteAcceptForm token={params.token} />
    </main>
  );
}
