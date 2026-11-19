/**
 * Seed demo in-app notifications for ONE dashboard user.
 *
 * The header bell's "Team" section reads persisted `Notification` rows, and those are
 * only ever written by real events — an invitation accepted, a comment mention, a
 * profile self-deletion, an ownership hand-over. An account that has not seen one of
 * those yet has an empty bell, which makes the Notifications UI (including the
 * per-message-type accordions) impossible to look at. This script writes a handful of
 * rows for one named user so the menu has something to render.
 *
 * The script is additive and self-describing:
 *
 *   - every row it writes has an exact title from `SEED_ROWS`, so a re-run only fills
 *     the titles that are missing and `--replace` removes ONLY this script's rows;
 *     nothing else in the table is touched;
 *   - rows are written straight to the table, NOT through `createNotification`, so no
 *     web push is sent to anybody's phone;
 *   - the Meetings and Documents sections are deliberately NOT seeded: those two are
 *     DERIVED from plan state on every fetch (a meeting in the next 0 / 2 / 7 days, a
 *     document expiring then) and writing fake plan data would be a much larger lie
 *     than a bell row. They keep showing their own empty state.
 *
 * Usage (see also `pnpm notifications:backfill`):
 *   npx tsx scripts/notifications/backfill-notifications.ts
 *   npx tsx scripts/notifications/backfill-notifications.ts --name "Eddie Taliaferro" --dry-run
 *   npx tsx scripts/notifications/backfill-notifications.ts --email eddie@example.com --replace
 */

import { createPrisma } from "../teammates/shared";

/**
 * A plain `npx tsx` run does not load `.env`; `createPrisma()` does, and widens the
 * pool for a CLI, which is why this script does not use the app's client.
 */
const prisma = createPrisma();

const DEFAULT_USER_NAME = "Eddie Taliaferro";

interface Options {
  name: string;
  email: string | null;
  dryRun: boolean;
  replace: boolean;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    name: DEFAULT_USER_NAME,
    email: null,
    dryRun: false,
    replace: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--replace") {
      options.replace = true;
    } else if (argument === "--name") {
      const value = argv[index + 1];
      if (!value) throw new Error("--name needs a value.");
      options.name = value;
      index += 1;
    } else if (argument === "--email") {
      const value = argv[index + 1];
      if (!value) throw new Error("--email needs a value.");
      options.email = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown flag: ${argument}`);
    }
  }

  return options;
}

interface SeedRow {
  type: string;
  title: string;
  body: string;
  href: string;
  /** How long before "now" the event happened; also spaces the rows out. */
  minutesAgo: number;
  read: boolean;
}

interface SeedContext {
  planId: string | null;
  planName: string;
  organizationName: string;
}

/**
 * The bell's real `type` values, so the rows are shaped exactly like the ones the app
 * writes. A plan-scoped comment link is only used when the user actually has a plan
 * (`/edit-client/{id}`); otherwise the row points at the Employee Resources index,
 * which every advisor can open.
 */
function seedRows(context: SeedContext): SeedRow[] {
  const planHref = context.planId
    ? `/edit-client/${context.planId}`
    : "/employee-resources";
  const planPhrase = context.planName ? ` on ${context.planName}` : "";

  return [
    {
      type: "team_member_accepted",
      title: "Jordan Blake accepted their invitation",
      body: "Jordan can now work on the plans you assigned.",
      href: "/settings?tab=members",
      minutesAgo: 4,
      read: false,
    },
    {
      type: "comment_mention",
      title: `Dana Whitfield mentioned you in a comment${planPhrase}`,
      body: "Can you take a look at the disclosure wording before Friday?",
      href: planHref,
      minutesAgo: 26,
      read: false,
    },
    {
      type: "comment_task_assigned",
      title: "Dana Whitfield assigned you a task",
      body: "Review the Employee Resources hub copy.",
      href: planHref,
      minutesAgo: 130,
      read: false,
    },
    {
      type: "profile_self_deleted",
      title: "Sam Okafor deleted their profile",
      body: "Confirm the plan assignments this collaborator leaves behind.",
      href: "/benefits",
      minutesAgo: 60 * 24,
      read: false,
    },
    {
      type: "team_member_accepted",
      title: "Priya Raman accepted their invitation",
      body: "Priya can now work on the plans you assigned.",
      href: "/settings?tab=members",
      minutesAgo: 60 * 24 * 3,
      read: true,
    },
    {
      type: "organization_ownership_transferred",
      title: `You are now the Owner of ${context.organizationName}`,
      body: "Ownership moved to you when the previous owner deleted their account.",
      href: "/settings",
      minutesAgo: 60 * 24 * 6,
      read: true,
    },
  ];
}

interface ResolvedUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
}

async function resolveUser(options: Options): Promise<ResolvedUser> {
  const where = options.email
    ? { email: { equals: options.email, mode: "insensitive" as const } }
    : { name: { equals: options.name, mode: "insensitive" as const } };

  const matches = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, organizationId: true },
    take: 5,
  });

  if (matches.length === 0) {
    const scope = options.email
      ? `email "${options.email}"`
      : `name "${options.name}"`;
    throw new Error(`No user with ${scope}. Pass --name or --email explicitly.`);
  }

  if (matches.length > 1) {
    const candidates = matches
      .map((user) => `  ${user.name} <${user.email}> (${user.id})`)
      .join("\n");
    throw new Error(
      `More than one user matches that name; re-run with --email.\n${candidates}`,
    );
  }

  const user = matches[0];

  // `User.organizationId` is the forward-looking tenancy anchor but can still be null
  // on an account that predates T1, so fall back to the organization the user owns,
  // then to any teammate profile their login backs. The notification list is scoped by
  // organizationId, so this must match what the session resolves at read time.
  let organizationId = user.organizationId;
  if (!organizationId) {
    const owned = await prisma.organization.findFirst({
      where: { ownerUserId: user.id },
      select: { id: true },
    });
    organizationId = owned?.id ?? null;
  }
  if (!organizationId) {
    const seat = await prisma.teammateProfile.findFirst({
      where: { loginUserId: user.id },
      select: { organizationId: true },
    });
    organizationId = seat?.organizationId ?? null;
  }
  if (!organizationId) {
    throw new Error(
      `No organization resolved for ${user.email}. Run \`pnpm teammates:backfill\` first.`,
    );
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const user = await resolveUser(options);

  const [plan, organization] = await Promise.all([
    prisma.client.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, companyName: true },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    }),
  ]);

  const rows = seedRows({
    planId: plan?.id ?? null,
    planName: plan?.companyName?.trim() || "your plan",
    organizationName: organization?.name?.trim() || "your organization",
  });

  console.log(`Notifications for ${user.name} <${user.email}>`);
  console.log(`  organization: ${user.organizationId}`);
  console.log(`  plan used for links: ${plan ? plan.companyName : "(none)"}`);

  const titles = rows.map((row) => row.title);
  const existing = await prisma.notification.findMany({
    where: { userId: user.id, title: { in: titles } },
    select: { id: true, title: true },
  });
  const existingTitles = new Set(existing.map((row) => row.title));

  const pending = options.replace
    ? rows
    : rows.filter((row) => !existingTitles.has(row.title));

  if (options.replace && existing.length > 0) {
    console.log(`  replacing ${existing.length} earlier seeded row(s)`);
  }
  if (pending.length === 0) {
    console.log("  nothing to do: every seeded notification is already present.");
    console.log("  pass --replace to reset them to their original read state.");
    return;
  }

  if (options.dryRun) {
    console.log(`\nDry run — would write ${pending.length} notification(s):`);
    for (const row of pending) {
      console.log(`  [${row.read ? "read" : "unread"}] ${row.title}`);
    }
    return;
  }

  if (options.replace) {
    await prisma.notification.deleteMany({
      where: { userId: user.id, title: { in: titles } },
    });
  }

  const now = Date.now();
  const data = pending.map((row) => {
    const createdAt = new Date(now - row.minutesAgo * 60_000);
    return {
      organizationId: user.organizationId,
      userId: user.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      // A read row keeps a real timestamp so the UI's muted treatment is exercised.
      readAt: row.read ? new Date(createdAt.getTime() + 60_000) : null,
      createdAt,
    };
  });

  await prisma.notification.createMany({ data });

  const unread = data.filter((row) => row.readAt === null).length;
  console.log(`\nWrote ${data.length} notification(s) — ${unread} unread.`);
  console.log("Reload the dashboard; the bell reads them on its next fetch.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
