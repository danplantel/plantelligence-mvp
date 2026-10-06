import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { NewLayoutClient } from "@/components/layout/layout-client";
import { authOptions } from "@/lib/auth-options";
import {
  getViewerAccess,
  type ViewerAccess,
} from "@/lib/teammates/viewer-access.server";

export const metadata: Metadata = {
  title: "PlanTelligence",
  description: "PlanTelligence Dashboard",
};

/** The answer the chrome uses before any client read: never narrowed. */
const OPEN_ACCESS: ViewerAccess = { isCollaborator: false, functions: null };

/**
 * Resolve the viewer's chrome access on the SERVER and hand it to the client layout.
 *
 * The sidebar and the page guard both need this answer at first paint. Left to the
 * client alone the summary starts empty, so a Collaborator would briefly see the nav and
 * the page they are not allowed to use, then watch them disappear. Seeding the read here
 * means the first frame is already correct.
 *
 * A failure resolves to "not a collaborator": the chrome must never be narrowed by a
 * transient error, and the API refuses the real action anyway.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const viewerAccess = userId
    ? await getViewerAccess(userId).catch(() => OPEN_ACCESS)
    : OPEN_ACCESS;

  return (
    <NewLayoutClient viewerAccess={viewerAccess}>{children}</NewLayoutClient>
  );
}
