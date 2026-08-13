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
  const currentClientId = searchParams.get('clientId');

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or invalid slug parameter' }, { status: 400 });
  }

  const sanitized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  if (!sanitized || sanitized.length === 0) {
    return NextResponse.json({ error: 'Slug contains no valid characters' }, { status: 400 });
  }

  try {
    // Completed plans: Client.slug is globally unique, so check across all users.
    // Exclude the current draft client being edited (if provided).
    const existingClient = currentClientId
      ? await prisma.client.findFirst({
          where: { slug: sanitized, id: { not: currentClientId } },
          select: { id: true, userId: true },
        })
      : await prisma.client.findUnique({
          where: { slug: sanitized },
          select: { id: true, userId: true },
        });

    // In-progress drafts: check other wizard sessions for the same user that
    // already claim this portal URL.
    const existingDraft = existingClient
      ? null
      : await prisma.newClientCompanyBasics.findFirst({
          where: {
            portalUrl: sanitized,
            session: {
              userId,
              id: { not: (searchParams.get('sessionId') || '') },
            },
          },
          select: { id: true },
        });

    const taken = Boolean(existingClient || existingDraft);

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
