const base = "http://localhost:3100";
const pattern = /og:image" content="([^"]+)/;

for (const [host, path] of [
  ["plantel.pro", "/signin"],
  ["plantel.ai", "/"],
]) {
  const response = await fetch(`${base}${path}`, {
    headers: { "x-forwarded-host": host },
    redirect: "manual",
  });
  const html = await response.text();
  const match = html.match(pattern);
  console.log(
    `${host}${path} -> ${response.status} ${match ? match[1] : "(no og:image)"}`,
  );
}
