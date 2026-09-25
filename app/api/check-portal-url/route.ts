// app/api/check-portal-url/route.ts
// GET /api/check-portal-url?slug=acme-corp&clientId=<optional>
// Checks whether a portal URL (plan slug) is already in use for the user's
// organization. The Client.slug field is globally unique, so if any plan uses
// the slug it cannot be reused.

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  // Optional: the current draft client ID to exclude from the "taken" check
  // (so editing a plan in progress doesn't flag its own URL as taken).
  const currentClientIdRaw = searchParams.get('clientId');

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or invalid slug parameter' }, { status: 400 });
  }

  const sanitized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  if (!sanitized || sanitized.length === 0) {
    return NextResponse.json({ error: 'Slug contains no valid characters' }, { status: 400 });
  }

  try {
    // Normalize the excluded client id: callers may pass a slug instead of the
    // ObjectId. Resolving it keeps a plan's OWN retired aliases from being
    // reported as "taken" when the advisor restores a previous URL.
    let excludeClientId = currentClientIdRaw || undefined;
    if (excludeClientId && !/^[a-f0-9]{24}$/i.test(excludeClientId)) {
      const owner = await prisma.client.findFirst({
        where: { OR: [{ slug: excludeClientId }, { id: excludeClientId }] },
        select: { id: true },
      });
      excludeClientId = owner?.id;
    }

    // Completed plans: a slug is globally unique, so check across all users.
    // Exclude the current draft client being edited (if provided).
    //
    // `findFirst`, not `findUnique`: `Client.slug` is deliberately no longer a
    // Prisma `@unique`. A MongoDB unique index treats every null as a real key,
    // so with several slug-less legacy plans the index is unbuildable and
    // `prisma db push` fails. Uniqueness for real slugs is guaranteed by
    // `PortalSlug.slug` (@unique, non-null) plus a partial unique index on this
    // column — see scripts/repair/apply-partial-unique-indexes.ts.
    const existingClient = excludeClientId
      ? await prisma.client.findFirst({
          where: { slug: sanitized, id: { not: excludeClientId } },
          select: { id: true, userId: true },
        })
      : await prisma.client.findFirst({
          where: { slug: sanitized },
          select: { id: true, userId: true },
        });

    // Resolve which wizard session to exclude from the draft "taken" check.
    // The client may pass an explicit sessionId; if not (or if it's not a valid
    // Mongo ObjectID), fall back to the user's most recent active (incomplete)
    // wizard session — i.e. the current draft being edited — so the user's own
    // NewClientCompanyBasics row never flags its own URL as taken.
    const requestedSessionId = (searchParams.get('sessionId') || '').trim();
    let excludeSessionId = /^[a-f0-9]{24}$/i.test(requestedSessionId)
      ? requestedSessionId
      : '';

    if (!excludeSessionId) {
      const activeSession = await prisma.newClientWizardSession.findFirst({
        where: { userId, completed: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (activeSession) excludeSessionId = activeSession.id;
    }

    // In-progress drafts: check other wizard sessions for the same user that
    // already claim this portal URL.
    const existingDraft = existingClient
      ? null
      : await prisma.newClientCompanyBasics.findFirst({
          where: {
            portalUrl: sanitized,
            session: {
              userId,
              ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
            },
          },
          select: { id: true },
        });

    // Global slug registry — this includes RETIRED aliases, which stay
    // permanently reserved to their original plan. So a slug that was merely
    // renamed away is still reported as taken (protecting old QR/printed links).
    const registered = await prisma.portalSlug.findUnique({
      where: { slug: sanitized },
      select: { clientId: true },
    });
    const registeredByOther =
      !!registered && registered.clientId !== excludeClientId;

    const taken = Boolean(existingClient || existingDraft || registeredByOther);

    return NextResponse.json({
      available: !taken,
      taken,
      slug: sanitized,
      ownedByCurrentUser: existingClient?.userId === userId,
    });
  } catch (error) {
    console.error('Error checking portal URL availability:', error);
    return NextResponse.json({ error: 'Failed to check portal URL availability' }, { status: 500 });
  }
}
