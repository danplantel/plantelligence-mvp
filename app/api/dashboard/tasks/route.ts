export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { listManualTasks, listSystemTasks } from "@/lib/dashboard-tasks.server";
import { listAccessiblePlanIds } from "@/lib/teammates/access.server";

/** Task titles are free text but short by nature; this bounds abuse and keeps rows readable. */
const MAX_TITLE_LENGTH = 200;

/**
 * Dashboard task list: derived system tasks plus the advisor's own stored tasks.
 *
 * The two sources are returned separately rather than pre-merged so the UI can label them —
 * only manual tasks are checkable, since a system task is resolved by fixing the plan rather
 * than by asserting it is done.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // System tasks are derived from the reader's accessible plans (owned + assigned), so a
    // teammate sees the same derived work for a shared plan as the owner. Manual tasks stay the
    // reader's own to-do list.
    const accessiblePlanIds = await listAccessiblePlanIds(userId);

    const [system, manual] = await Promise.all([
      listSystemTasks(accessiblePlanIds),
      listManualTasks(userId, accessiblePlanIds),
    ]);

    return NextResponse.json({ success: true, data: { system, manual } });
  } catch (error) {
    console.error("Error loading dashboard tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json().catch(() => null);

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "A task title is required" }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Task titles are limited to ${MAX_TITLE_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Optional plan link. Verified against the user's own plans so a task cannot be attached
    // to someone else's record by passing an arbitrary id.
    const requestedClientId =
      typeof body?.clientId === "string" && body.clientId.trim()
        ? body.clientId.trim()
        : null;

    if (requestedClientId) {
      // A task may be linked to any plan the reader can reach — owned OR assigned through a seat —
      // not only one they own, so a teammate can file work against a shared plan.
      const accessiblePlanIds = await listAccessiblePlanIds(userId);
      if (!accessiblePlanIds.includes(requestedClientId)) {
        return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
      }
    }

    const task = await prisma.task.create({
      data: { userId, title, clientId: requestedClientId },
      select: {
        id: true,
        title: true,
        done: true,
        createdAt: true,
        clientId: true,
      },
    });

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
