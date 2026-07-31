// app/api/check-subdomain/route.ts
// GET /api/check-subdomain?subdomain=my-org
// Checks if a portal subdomain is already taken by another user.

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
  const subdomain = searchParams.get('subdomain');

  if (!subdomain || typeof subdomain !== 'string' || subdomain.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or invalid subdomain parameter' }, { status: 400 });
  }

  // Only allow lowercase alphanumeric + hyphens (the sanitized form)
  const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!sanitized || sanitized.length === 0) {
    return NextResponse.json({ error: 'Subdomain contains no valid characters' }, { status: 400 });
  }

  try {
    // Check if any user (other than the current user) already owns this subdomain
    const existing = await prisma.user.findFirst({
      where: {
        subdomain: sanitized,
        id: { not: userId },
      },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existing,
      subdomain: sanitized,
    });
  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    return NextResponse.json({ error: 'Failed to check subdomain availability' }, { status: 500 });
  }
}
