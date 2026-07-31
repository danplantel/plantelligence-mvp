// app/api/profile/update-disclaimer/route.ts
// POST /api/profile/update-disclaimer
// Body: { disclaimer: string }
// Updates the current user's disclaimer field on the User record.

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (typeof body.disclaimer !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid disclaimer field' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { disclaimer: body.disclaimer },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating disclaimer:', error);
    return NextResponse.json({ error: 'Failed to update disclaimer' }, { status: 500 });
  }
}
