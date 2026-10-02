// app/api/profile/route.ts

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { step2ServicesToCategories } from '@/lib/service-categories';
import { getEffectiveWizardUserSetup } from '@/lib/effective-wizard-user-setup';
import {
  findTeammateProfileForUser,
  organizationProfileForViewer,
  syncOrganizationIdentity,
} from '@/lib/organization';
import { resolvePortalAdvisorId } from '@/lib/portal-access';

export async function GET(request: NextRequest) {
  const forPortal = request.nextUrl.searchParams.get('forPortal') === '1';

  // Public portal: return only the advisor's public signature fields so the
  // welcome banner renders for anonymous employees. Never expose the full
  // profile (wizard sessions, compliance data, etc.) over the public portal.
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
    // forPortal set but no resolvable plan (e.g. localhost preview while
    // logged in) — return the same lightweight public signature profile instead
    // of falling through to the heavy full-profile flow below. The full profile
    // includes every wizard session relation and runs getEffectiveWizardUserSetup,
    // which adds several serial DB round trips and slows portal first paint.
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;
    if (sessionUserId) {
      const publicUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // The organization is read ALONGSIDE the profile rather than after it: the two reads are
    // independent, and serialising them would add a round trip to every Settings load.
    const [profile, organization, seat] = await Promise.all([
      prisma.user.findUnique({
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
      }),
      organizationProfileForViewer(userId),
      // The reader's own seat, when an invitation gave them one. Three independent reads, so
      // none of them waits on another.
      findTeammateProfileForUser(userId),
    ]);

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
      // The organization's own values, with `viewerIsOwner`. An invited teammate's row carries
      // none of them (the acceptance flow created it from a name and an email), so Settings →
      // Branding AND Settings → Organization opened blank for a teammate of an organization that
      // plainly has a name, logo, colours, mission statement, type and team size.
      // `viewerIsOwner` is what tells the client whether to prefer these values or the reader's
      // own; they never override a value the reader set themselves.
      //
      // Also carries `primaryServiceCategories` and the firm email — the two Profile-tab values a
      // teammate's own row has none of.
      organization,
      // The reader's own seat profile — job title, phone, extension, designations, photo. For an
      // invited teammate this is where Settings → Profile's details actually are; the route's
      // `User` row was created from a name and an email at acceptance. Null for anyone without a
      // seat, so an owner's payload is unchanged.
      seat,
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
    // The session is the authority for WHICH row is written. This handler used to trust a
    // body-supplied `data.id`, so any caller could rewrite another user's name,
    // organizationEmail and primaryServiceCategories without authenticating at all.
    //
    // A body id is still accepted for compatibility with the Settings form, but only when it
    // names the caller. A mismatch is rejected rather than ignored, deliberately: a wrong id
    // should be a loud failure, not a silent no-op that returns 200 and looks like a save.
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (data?.id && String(data.id) !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const profile = await prisma.user.update({
      where: { id: sessionUserId },
      data: {
        name: data.name,
        phone: data.phone,
        organizationType: data.organizationType,
        advisorName: data.advisorName,
        advisorEmail: data.advisorEmail,
        advisorPhone: data.advisorPhone,
        disclaimer: data.disclaimer,
        advisorLogoUrl: data.advisorLogoUrl,
        complianceEmail: data.complianceEmail,
        advisorLink: data.advisorLink,
        additionalAdvisorLink: data.additionalAdvisorLink,
        recordkeeperContactLabel: data.recordkeeperContactLabel,
        ...(data.organizationEmail !== undefined && {
          organizationEmail: data.organizationEmail || null,
        }),
        // The firm profile. These are the canonical `User` fields the onboarding wizard
        // copies out of its own session tables (see `wizard-completion.ts`), which is why
        // Settings -> Organization writes them HERE rather than into `wizardSessions[0]`: a
        // wizard session is one advisor's draft, so an edit saved there was invisible to the
        // organization and left the User row stale.
        ...(data.customOrganization !== undefined && {
          customOrganization: data.customOrganization || null,
        }),
        ...(data.teamSize !== undefined && { teamSize: data.teamSize || null }),
        ...(data.primaryServiceCategories !== undefined && { primaryServiceCategories: data.primaryServiceCategories }),
      } as any,
    });

    // The Organization mirrors the owner's identity: every invitation email reads
    // `organizationName` from it, and the T3 Team-Member domain guess reads
    // `organizationEmail`. Without this a profile save wrote only the User row and those
    // reads kept using whatever was true at signup.
    //
    // Best-effort on purpose — a mirror that cannot be refreshed must not fail the edit the
    // user just made, and a stale mirror beats a lost change.
    await syncOrganizationIdentity(profile.id).catch((error) => {
      console.error('[profile] organization identity sync failed', error);
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
