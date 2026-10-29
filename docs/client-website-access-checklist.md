# Website access issue — steps to try

Client-facing copy. Safe to send as-is: no infrastructure details, no internal
hostnames or IP addresses, and no code references. The internal version of this
investigation stays in
[`troubleshooting-dev-plantel-pro-connectivity.md`](troubleshooting-dev-plantel-pro-connectivity.md:1).

---

## What the message means

"Unexpectedly closed the connection" appears when your browser's secure
connection to the site is closed **before** the page is requested. That means the
site never got a chance to respond.

The important clue is that it works on your mobile hotspot. When the same device
and browser succeed on one connection and fail on another, the site itself is
fine and something on the home network's path is interrupting the connection.

## Please try these first (about 5–10 minutes)

Work down the list and note where things stand. Most people are fixed by step 5.

1. **Check whether it's the network or the computer.** On the same home Wi-Fi,
   open the site on your phone with mobile data turned **off**. If the phone also
   fails, the problem is the home network. If the phone works, it's specific to
   the computer and we can focus there.

2. **Try a private / incognito window.** This rules out browser extensions and
   cached data.

3. **Try a second browser** (Edge, Chrome, Firefox, or Safari).

4. **Restart your router.** Unplug it for 30 seconds, plug it back in, wait two
   minutes for it to reconnect, then reload the page.

5. **Temporarily pause your antivirus "web shield".** In Avast, AVG, Kaspersky,
   ESET, Bitdefender, and Norton this is called *HTTPS scanning*, *SSL scanning*,
   *Web Shield*, or *Safe Web*. Turn that one feature off, reload, then turn it
   back on afterwards.

6. **Allow the site in your router's security or parental controls.** Some
   routers (and mesh systems such as Eero Secure, Netgear Armor, or Orbi Armor)
   filter sites by name and silently drop the connection. Add our domain to the
   allowed/trusted list.

7. **Change your router's DNS servers** to `1.1.1.1` and `8.8.8.8`. This is in
   the router's internet or DHCP settings. If your internet provider applies its
   own filtering, this bypasses it.

8. **Turn IPv6 off temporarily.** This is the most common cause of a site that
   works on a hotspot but not at home. If your router has an IPv6 on/off switch
   under its internet settings, turn it off, reconnect, and reload. On Windows you
   can alternatively open *Network & internet → your adapter → IPv6 → Off*.

9. **Pause any VPN or security app** that may be inspecting traffic, including
   "safe browsing" features on the router, and retry.

## What to send us if none of that works

- Which steps you tried and what happened at each one.
- The exact error text and which browser it appeared in.
- Whether a phone on the same Wi-Fi also fails.
- Your home network's **public IP address** — open a site like `ifconfig.me`
  while connected to your home Wi-Fi. We can check whether that address is being
  blocked on our side, which is the one cause we can fix ourselves.
- A screenshot of this command's output:
  - **Windows:** open Command Prompt and run `nslookup dev.plantel.pro`
  - **Mac:** open Terminal and run `dig dev.plantel.pro`

We only need the output text — it contains nothing personal.

## While this is being sorted

Reply to let us know you've worked through the list and we'll send you a
temporary alternate address for the site that avoids the name-level problem, so
you're not blocked in the meantime.
