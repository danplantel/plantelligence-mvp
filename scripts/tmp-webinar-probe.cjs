/* Temporary diagnostic: find a plan that has webinars and report how many bytes of
   base64 video the list endpoint would have to ship for it. Delete after use. */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith("DATABASE_URL"));
  if (!line) return undefined;
  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient({
  datasources: { db: { url: readDatabaseUrl() } },
});

(async () => {
  const clients = await prisma.client.findMany({
    select: { id: true, slug: true },
  });

  let reported = 0;
  for (const client of clients) {
    const webinars = await prisma.webinar.findMany({
      where: { clientId: client.id },
      select: { webinarTitle: true, videoSize: true, placements: true },
    });
    if (webinars.length === 0) continue;

    const base64Bytes = webinars.reduce((n, w) => n + (w.videoSize || 0), 0);
    console.log(
      `${client.id} | slug=${client.slug} | webinars=${webinars.length} | base64Bytes=${base64Bytes}`,
    );
    console.log(
      `   ${webinars
        .map(
          (w) =>
            `${w.webinarTitle} [size=${w.videoSize ?? 0}] placements=${JSON.stringify(w.placements)}`,
        )
        .join("\n   ")}`,
    );
    reported += 1;
  }

  if (reported === 0) console.log("No clients have webinars.");
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
