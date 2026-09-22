export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/** Mirrors the limit enforced on create. */
const MAX_TITLE_LENGTH = 200;

type RouteContext = { params: { id: string } };

/**
 * Updates a manual task — currently ticking it off or renaming it.
 *
 * System tasks have no route here: they are derived from plan state, so there is nothing to
 * mark done. Fixing the plan is what clears them.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = params;

    // Scoped by userId, so another advisor's task id resolves to a 404 rather than 403.
    const existing = await prisma.task.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);

    const data: { done?: boolean; doneAt?: Date | null; title?: string } = {};

    if (typeof body?.done === "boolean") {
      data.done = body.done;
      // Stamped alongside the flag so a completion time exists if it is ever needed; cleared
      // on un-tick so a reopened task cannot look completed.
      data.doneAt = body.done ? new Date() : null;
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (title) {
      if (title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          { error: `Task titles are limited to ${MAX_TITLE_LENGTH} characters` },
          { status: 400 },
        );
      }
      data.title = title;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        done: true,
        createdAt: true,
        clientId: true,
      },
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const existing = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
