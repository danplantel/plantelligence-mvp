// app/api/profile/route.ts

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { step2ServicesToCategories } from '@/lib/service-categories';
import { getEffectiveWizardUserSetup } from '@/lib/effective-wizard-user-setup';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wizardSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            branding: true,
            userSetup: true,
            clientProfile: true,
            teamSize: true,
            services: true,
            disclaimers: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const firstSession = profile.wizardSessions?.[0];
    let userSetup: any = await getEffectiveWizardUserSetup(
      userId,
      firstSession?.userSetup ?? null,
    );

    // Ensure primaryServiceCategories is always an array; derive from Step 2 services if empty (for step-3b autofill)
    const rawServices = firstSession?.services?.services;
    const servicesArray = Array.isArray(rawServices) ? rawServices : [];
    let primaryServiceCategories: string[] = Array.isArray(userSetup?.primaryServiceCategories)
      ? [...(userSetup.primaryServiceCategories as string[])]
      : [];
    if (primaryServiceCategories.length === 0 && servicesArray.length > 0) {
      primaryServiceCategories = step2ServicesToCategories(servicesArray);
    }
    if (userSetup) {
      userSetup = { ...userSetup, primaryServiceCategories };
    } else if (primaryServiceCategories.length > 0) {
      userSetup = { primaryServiceCategories };
    }

    const rootCategories = primaryServiceCategories.length > 0
      ? primaryServiceCategories
      : (Array.isArray((profile as any).primaryServiceCategories) ? (profile as any).primaryServiceCategories : []);

    const response = {
      ...profile,
      advisorBackgroundImage:
        (userSetup?.backgroundImage && String(userSetup.backgroundImage).trim()) ||
        null,
      phone: userSetup?.phone || profile.phone,
      phoneExtension: userSetup?.phoneExtension ?? profile.phoneExtension ?? null,
      title: userSetup?.title || profile.title,
      headshot: userSetup?.headshot || null,
      headshotData: userSetup?.headshotData || null,
      saveAsContact: userSetup?.saveAsContact ?? true,
      primaryServiceCategories: rootCategories,
      wizardSessions: profile.wizardSessions.map((s) => ({
        ...s,
        userSetup: s === firstSession ? userSetup : (s as any).userSetup,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const profile = await prisma.user.update({
      where: { id: data.id },
      data: {
        name: data.name,
        phone: data.phone,
        company: data.company,
        advisorName: data.advisorName,
        advisorEmail: data.advisorEmail,
        advisorPhone: data.advisorPhone,
        disclaimer: data.disclaimer,
        advisorLogoUrl: data.advisorLogoUrl,
        complianceEmail: data.complianceEmail,
        advisorLink: data.advisorLink,
        additionalAdvisorLink: data.additionalAdvisorLink,
        recordkeeperContactLabel: data.recordkeeperContactLabel,
        ...(data.primaryServiceCategories !== undefined && { primaryServiceCategories: data.primaryServiceCategories }),
      } as any,
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export function OPTIONS() {
  return NextResponse.json({ message: 'Options method' });
}
