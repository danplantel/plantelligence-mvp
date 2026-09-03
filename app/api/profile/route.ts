// app/api/profile/route.ts

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { step2ServicesToCategories } from '@/lib/service-categories';
import { getEffectiveWizardUserSetup } from '@/lib/effective-wizard-user-setup';
import { resolvePortalAdvisorId } from '@/lib/portal-access';

export async function GET(request: NextRequest) {
  const forPortal = request.nextUrl.searchParams.get('forPortal') === '1';

  // Public portal: return only the advisor's public signature fields so the
  // welcome banner renders for anonymous employees. Never expose the full
  // profile (wizard sessions, compliance data, etc.) over the public subdomain.
  if (forPortal) {
    const portalAdvisorId = await resolvePortalAdvisorId(request);
    if (portalAdvisorId) {
      const publicUser = await prisma.user.findUnique({
        where: { id: portalAdvisorId },
        select: {
          name: true,
          email: true,
          organizationName: true,
          title: true,
          headshot: true,
          designations: true,
        },
      });
      if (publicUser) {
        const publicProfile = {
          name: publicUser.name,
          email: publicUser.email,
          organizationName: publicUser.organizationName ?? '',
          title: publicUser.title ?? '',
          headshot: publicUser.headshot ?? null,
          designations: publicUser.designations ?? [],
        };
        return NextResponse.json({
          ...publicProfile,
          // Some portal components read the profile under `.user.*`.
          user: publicProfile,
        });
      }
    }
    // forPortal set but no resolvable advisor (e.g. apex/localhost preview while
    // logged in) — fall through to the normal session flow below.
  }

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

    // Derive primaryServiceCategories from User.primaryServiceCategories or Step 2 services (for step-3b autofill)
    // WizardUserSetup no longer stores primaryServiceCategories.
    const rawServices = firstSession?.services?.services;
    const servicesArray = Array.isArray(rawServices) ? rawServices : [];
    const userCategories = Array.isArray((profile as any).primaryServiceCategories)
      ? (profile as any).primaryServiceCategories
      : [];
    let primaryServiceCategories: string[] =
      userCategories.length > 0 ? [...userCategories] : [];
    if (primaryServiceCategories.length === 0 && servicesArray.length > 0) {
      primaryServiceCategories = step2ServicesToCategories(servicesArray);
    }

    const response = {
      ...profile,
      disclaimer: (profile as any).disclaimer ?? null,
      advisorBackgroundImage:
        (userSetup?.backgroundImage && String(userSetup.backgroundImage).trim()) ||
        null,
      phone: userSetup?.phone || profile.phone,
      phoneExtension: userSetup?.phoneExtension ?? profile.phoneExtension ?? null,
      title: userSetup?.title || profile.title,
      headshot: userSetup?.headshot || (profile as any).headshot || null,
      headshotData: userSetup?.headshotData || (profile as any).headshotData || null,
      saveAsContact: userSetup?.saveAsContact ?? true,
      primaryServiceCategories,
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
