# Triage: `dev.plantel.pro` "unexpectedly closed the connection" on one network only

## Symptom

Client sees, in the browser:

```
This site can't be reached
dev.plantel.pro unexpectedly closed the connection.
```

- Fails on their **home Wi-Fi**.
- Works on their **mobile hotspot**.

That combination is the important part: the same browser, same device, same
build — only the network path changes.

## What this rules out

`ERR_CONNECTION_CLOSED` (Chrome) / "unexpectedly closed the connection" is
raised during or immediately after the TLS handshake. **No HTTP request is
completed**, so no application code runs:

- Middleware in [`middleware.ts`](../middleware.ts:40) is never reached.
- Vercel crons in [`vercel.json`](../vercel.json:1) are irrelevant here.
- Host-based redirects in [`lib/marketing/host.ts`](../lib/marketing/host.ts:149)
  are irrelevant — a redirect would show `ERR_TOO_MANY_REDIRECTS`, and an
  origin mismatch would show a normal 3xx, not a dead socket.

So this is not a bug in the dev branch. It is one of:

1. **DNS filtering on the home network** resolving the name to a block page /
   sinkhole, or not resolving it at all.
2. **TLS interception / reset** by the router's built-in security suite, ISP
   "web safe" filtering, or an antivirus HTTPS scanner.
3. **IPv6 path failure** — if an `AAAA` record is served and the home CPE
   advertises IPv6 it cannot actually route, the browser's first attempt is
   black-holed or reset.
4. **The home public IP is being reset at the Vercel edge** — Vercel Firewall /
   Attack Challenge Mode / DDoS mitigation blocking that IP. The hotspot has a
   different IP, which explains the clean split.
5. **Path/MTU problems** on PPPoE-style home connections, where the TLS
   ClientHello is dropped.

## Current DNS facts (verified 2026-10-29)

```
dev.plantel.pro  CNAME  cb09dc2e6d9306ef.vercel-dns-016.com
cb09dc2e6d9306ef.vercel-dns-016.com  A  216.150.1.129
cb09dc2e6d9306ef.vercel-dns-016.com  A  216.150.16.129
```

Confirmed identically via `1.1.1.1` and `8.8.8.8`. Both `plantel.pro` and
`dev.plantel.pro` terminate on the same Vercel anycast range, which makes the
next test very cheap.

## Test order for the client (fast → slow)

Run these **on the home Wi-Fi**, and repeat the marked ones on the hotspot as a
control.

### 1. Is it the domain or the whole Vercel range?

| URL | Result | Meaning |
| --- | --- | --- |
| `https://plantel.pro` | also fails | The **Vercel edge IPs** are blocked on their network (ISP/ router/ firewall) |
| `https://plantel.pro` | works | Failure is specific to the `dev.` host — DNS entry, or host-based filtering |

Also try the raw deployment URL (`https://<project>-git-dev-<team>.vercel.app`).
If that loads on the same Wi-Fi while `dev.plantel.pro` does not, the problem is
the **custom domain name** (DNS/SNI filtering), not the server.

### 2. Does DNS resolve to what it should?

Windows (Command Prompt):

```
nslookup dev.plantel.pro
nslookup dev.plantel.pro 1.1.1.1
nslookup dev.plantel.pro 8.8.8.8
```

macOS / Linux:

```
dig +short dev.plantel.pro
dig +short dev.plantel.pro @1.1.1.1
```

- All three should report `216.150.1.129` / `216.150.16.129`.
- If the first command differs from the last two, their **router or ISP DNS is
  rewriting the answer** (parental controls, Pi-hole, NextDNS, AdGuard, ISP
  "Advanced Security" / "Web Safe" / "Shield" features).
- If it answers `0.0.0.0`, `127.0.0.1`, or an unfamiliar IP, it is a block page.

### 3. Does the TCP/TLS connection open at all?

Windows 10/11 and macOS both ship `curl`:

```
curl -vI --max-time 20 https://dev.plantel.pro
```

- `Connection reset by peer` / `SSL_ERROR_SYSCALL` / empty reply → something on
  the path is killing the connection (interception or edge-level block).
- A normal `HTTP/2 200` or `HTTP/2 3xx` → the network is fine and the issue is
  browser-local (extensions, cached HSTS, profile).

### 4. IPv6 check (only if step 2 shows an `AAAA` answer)

```
nslookup -type=AAAA dev.plantel.pro
ping -6 dev.plantel.pro
```

If `ping -6` fails but `ping -4 dev.plantel.pro` succeeds, disable IPv6 on the
client's adapter or on the router and retest. This is the single most common
cause of "works on hotspot, fails at home" and the fastest thing to try:
Windows → Settings → Network → adapter → IPv6 → off, reconnect, reload.

### 5. Rule out local software

- Incognito/private window (kills extension interference).
- Disable "HTTPS scanning / web shield" in the antivirus (Avast, AVG, Kaspersky,
  ESET, Bitdefender, Norton) and retest.
- Reboot the router, or test on a second device on the same Wi-Fi. If a phone on
  the same Wi-Fi also fails, it is the network, not the laptop.

## If the client's home IP is the problem (server-side check)

This is the one cause that looks identical to a network fault but is ours to fix.

1. Ask the client for their public IP while on home Wi-Fi
   (`https://ifconfig.me` or Google "what is my ip").
2. In Vercel → project → **Firewall** tab, check recent *denied / challenged*
   requests and the blocked-IP list for that address.
3. In Vercel → project → **Logs**, filter by that IP. If **no requests appear at
   all** for the failure window, the connection never reached Vercel and it is
   purely the client's network path.
4. If the IP is being mitigated, add a bypass rule for it in
   **Firewall → Custom Rules** (or check whether Attack Challenge Mode is on).

## Likely fixes, in order of probability

1. Disable IPv6 on the client's home router/adapter, or fix its IPv6 delegation.
2. Whitelist `dev.plantel.pro` (and `*.vercel-dns-016.com`) in the router's
   security/parental controls and in the antivirus HTTPS scanner.
3. Switch the router's DNS from the ISP default to `1.1.1.1` / `8.8.8.8`, which
   also rules out an ISP-side DNS filter.
4. If the whole Vercel IP range is blocked by the ISP, open a ticket with the ISP
   — the `216.150.x.x` range is new and some filters still block it.

## Short-term workaround

While this is being sorted, give the client the `*.vercel.app` deployment URL for
the dev branch. It terminates on the same infrastructure but on a different
hostname, so it bypasses domain-name/DNS filtering and confirms the diagnosis
either way.
