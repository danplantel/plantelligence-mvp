// app/api/user/[id]/route.ts

import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract ID from URL path

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const data = await request.json();
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // Extract ID from URL path

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        phoneExtension: data.phoneExtension,
        company: data.company,
        advisorName: data.advisorName,
        advisorEmail: data.advisorEmail,
        advisorPhone: data.advisorPhone,
        advisorPhoneExtension: data.advisorPhoneExtension,
        disclaimer: data.disclaimer,
        advisorLogoUrl: data.advisorLogoUrl,
        complianceEmail: data.complianceEmail,
        advisorLink: data.advisorLink,
        additionalAdvisorLink: data.additionalAdvisorLink,
        recordkeeperContactLabel: data.recordkeeperContactLabel,
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
