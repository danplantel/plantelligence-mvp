# Auth Testing

This document is the test inventory for sign-in, sign-up, verification code, forgot/reset password, the resume-onboarding link, and the route protection that ties them together. It is generated from the Vitest JSON report.

## Summary

- **Unit tests:** 161 passing across 18 files
- **Runner:** Vitest + React Testing Library + jsdom
- **E2E:** 12 Playwright journeys in `e2e/auth.spec.ts`; the page/API journeys run against a live app, the authenticated ones also need `E2E_EMAIL` / `E2E_PASSWORD`

## Running these tests

Auth-only commands:

```bash
pnpm test:auth           # all 18 auth unit suites (161 tests)
pnpm test:auth:watch     # auth unit tests in watch mode
pnpm test:auth:coverage  # auth unit tests + V8 coverage
pnpm test:auth:e2e       # the 12 Playwright auth journeys
pnpm test:auth:all       # auth unit + E2E
```

These are backed by `vitest.auth.config.mts` and
`scripts/tests/run-auth-tests.mjs`.

All tests:

```bash
pnpm test                 # whole unit suite
pnpm test:watch           # unit tests in watch mode
pnpm test:coverage        # unit tests + V8 coverage
pnpm test:e2e:install     # install Chromium once
pnpm test:e2e             # Playwright E2E
pnpm test:e2e:ui          # Playwright UI mode
```

## End-to-end tests

File: `e2e/auth.spec.ts`

These require `E2E_BASE_URL` (or `E2E_START_SERVER=1`); the authenticated
journeys also need `E2E_EMAIL` / `E2E_PASSWORD`. They skip cleanly when
unconfigured.

- **auth pages**
  - an anonymous dashboard visit is sent to sign-in with a `callbackUrl`
  - an anonymous settings visit keeps the deep link in the `callbackUrl`
  - sign-in offers credentials, Google, sign-up, and forgot-password
  - sign-in rejects an invalid email before contacting the server
  - sign-in shows a friendly message for bad credentials
  - sign-up enforces the shared password policy
  - forgot-password is reachable and validates the email
  - the reset endpoint refuses a request without a verified token
  - forgot-password returns a neutral response for unknown emails
- **authenticated sign-in**
  - valid credentials leave the sign-in page
  - a `callbackUrl` deep link is honoured after signing in
  - an already signed-in visitor with a `callbackUrl` skips the form

## Test inventory

| # | Suite | Tests | Focus |
| - | ----- | ----: | ----- |
| 1 | `lib/__tests__/form-schema.test.ts` | 24 | Shared Zod schemas: password policy, sign-up/reset/sign-in validation |
| 2 | `lib/__tests__/middleware.test.ts` | 16 | Route protection: static/portal/API bypass, sign-in redirect, onboarding gate, cookie names |
| 3 | `lib/__tests__/reset-token.server.test.ts` | 6 | Signed reset tokens: round-trip, tampering/secret changes, expiry, missing secret |
| 4 | `lib/__tests__/sign-in-redirect.test.ts` | 12 | Pure navigation rules: callbackUrl parsing, onboarding collapse, post-sign-in landing |
| 5 | `app/api/__tests__/auth-routes.test.ts` | 25 | API contracts: forget, verify-code, reset-password, signup sanitization, check-email |
| 6 | `components/forms/__tests__/forget-password-form.test.tsx` | 7 | Forgot password: validation, neutral request, API/network errors, loading, auto-clear |
| 7 | `components/forms/__tests__/google-auth-button.test.tsx` | 5 | Google OAuth: default role-aware landing and preservation of middleware deep links |
| 8 | `components/forms/__tests__/reset-pass-form.test.tsx` | 10 | Reset password: shared policy, match, verified-token POST, errors, loading, visibility |
| 9 | `components/forms/__tests__/resume-onboarding-link.test.tsx` | 4 | Resume link dialog: open, opaque submit, failure, cancel/reset |
| 10 | `components/forms/__tests__/user-auth-form.test.tsx` | 9 | Credentials sign-in: reveal timing, validation, callback/default landing, errors, loading, links |
| 11 | `components/forms/__tests__/user-signup-form.test.tsx` | 13 | Sign-up: password rules/match, email availability, auto sign-in, API errors, loading, visibility |
| 12 | `components/forms/__tests__/verify-code-form.test.tsx` | 8 | Verify code: 6-digit validation, API payload, reset-password redirect with token, errors, loading |
| 13 | `app/(dashboard)/forget/__tests__/page.test.tsx` | 4 | Forgot-password route shell: heading, description, copyright, logo, theme |
| 14 | `app/(dashboard)/reset-password/__tests__/page.test.tsx` | 4 | Reset-password route shell: heading, description, copyright, logo, theme |
| 15 | `app/(dashboard)/signup/__tests__/page.test.tsx` | 4 | Sign-up route shell: form, light/dark/system logo, theme toggle |
| 16 | `app/(dashboard)/verify-code/__tests__/page.test.tsx` | 4 | Verify-code route shell: heading, description, copyright, logo, theme |
| 17 | `app/(dashboard)/signin/__tests__/page.test.tsx` | 1 | Sign-in route shell delegates to the SignIn screen |
| 18 | `components/pages/sign-in/__tests__/sign-in.test.tsx` | 5 | Sign-in screen: form + resume link, light/dark/system logo, theme toggle, authenticated redirect wiring |

## Unit test inventory

### `lib/__tests__/form-schema.test.ts`

**passwordSchema**

- accepts a password with all four character classes
- accepts exactly 8 characters
- rejects passwords shorter than 8 characters
- rejects passwords longer than 128 characters
- requires at least one uppercase character
- requires at least one lowercase character
- requires at least one number character
- requires at least one special character

**signupSchema**

- accepts a complete, matching sign-up payload
- requires a name
- caps the name at 100 characters
- rejects an invalid email
- caps the email at 254 characters
- applies the shared password policy
- reports a password mismatch on confirmPassword
- requires the confirmation field

**resetPasswordSchema**

- accepts matching passwords that satisfy the policy
- enforces the password policy
- rejects a mismatch on confirmPassword
- rejects an empty confirmation

**signinSchema**

- accepts a valid email and a non-empty password
- rejects an invalid email
- requires a password
- does not apply the password policy at sign-in time


### `lib/__tests__/middleware.test.ts`

**middleware**

- stamps the request path on pass-through responses
- lets static assets through without checking the session
- leaves portal pages public
- leaves API routes to their own auth handling
- does not gate paths that merely share an app route prefix
- sends anonymous visitors to sign-in with a relative callbackUrl
- keeps search parameters in the callbackUrl
- protects nested app paths
- protects the onboarding wizard itself
- passes an onboarded user through to app routes
- sends an incomplete user to onboarding from any app route
- allows an incomplete user to stay on onboarding
- does not bounce a completed user away from onboarding
- does not gate the sign-in page
- reads the dev session cookie outside production
- reads the secure session cookie in production


### `lib/__tests__/reset-token.server.test.ts`

**reset token**

- round-trips a normalized email
- rejects a malformed token
- rejects a token signed with another secret
- rejects a token with the wrong purpose
- rejects an expired token
- refuses to create a token without a configured secret


### `lib/__tests__/sign-in-redirect.test.ts`

**resolveSignInRedirect**

- does not redirect while the session is still loading
- does not redirect a signed-out visitor
- does not redirect an authenticated visitor without a callbackUrl
- sends an authenticated visitor to a non-onboarding deep link as-is
- collapses any onboarding deep link to /onboarding

**resolvePostSignInPath**

- prefers the URL resolved by NextAuth
- falls back to the callbackUrl from the query
- falls back to the role-aware landing route
- never navigates back to /signin

**getCallbackUrl**

- reads and decodes the callbackUrl parameter
- returns null when the parameter is absent
- treats an empty callbackUrl as absent


### `app/api/__tests__/auth-routes.test.ts`

**auth API routes › POST /api/forget**

- rejects a missing email
- returns a neutral response for an unknown account
- emails a six-digit code and stores its expiry
- returns 500 when the email cannot be sent and does not store a code

**auth API routes › POST /api/verify-code**

- rejects missing fields
- returns 404 for an unknown account
- rejects a wrong code
- rejects an expired code
- clears the code and issues a reset token on success

**auth API routes › POST /api/reset-password**

- rejects missing fields
- rejects a missing or invalid reset token before touching the user
- rejects a token issued for a different email
- returns 404 when the verified account no longer exists
- rejects a password shorter than eight characters
- hashes and stores the new password
- returns 500 when the update fails

**auth API routes › POST /api/signup**

- rejects missing fields
- rejects a duplicate email
- hashes the password and never returns it
- returns 500 on an unexpected error

**auth API routes › GET /api/check-email**

- rejects a missing email
- rejects a malformed email
- lowercases and trims the email before lookup
- reports an existing email as unavailable
- returns 500 when the lookup fails


### `components/forms/__tests__/forget-password-form.test.tsx`

**ForgetPasswordForm**

- renders the email field and submit button
- rejects an invalid email without calling the API
- requests a reset code and routes to verification
- shows the API error message
- shows a generic error for network failures
- shows the loading state and disables the field
- clears the error after eight seconds


### `components/forms/__tests__/google-auth-button.test.tsx`

**GoogleSignInButton**

- renders the Google call to action
- does not start OAuth until the button is pressed
- falls back to the role-aware landing route
- preserves a callbackUrl supplied by middleware
- preserves a deep link with query parameters


### `components/forms/__tests__/reset-pass-form.test.tsx`

**ResetPasswordForm**

- renders both password fields and the policy hint
- requires at least eight characters
- requires every character class
- requires the passwords to match
- resets the password with the verified token
- shows the API error message
- shows a generic error for network failures
- shows the loading state and disables both fields
- toggles both password fields
- posts an empty token when the query has none


### `components/forms/__tests__/resume-onboarding-link.test.tsx`

**ResumeOnboardingLink**

- opens a dialog with an email field
- posts the email and shows the neutral confirmation
- shows the same neutral confirmation when the request fails
- Cancel closes the dialog and resets the form


### `components/forms/__tests__/user-auth-form.test.tsx`

**UserAuthForm (sign in)**

- shows only the email field until an email is typed
- validates the email and password
- toggles password visibility
- signs in with the callbackUrl from the query
- falls back to the role-aware landing path
- maps a credentials error to a friendly message
- maps an unknown error to the generic message
- shows the loading state while the request is in flight
- renders the alternate auth links and Google button


### `components/forms/__tests__/user-signup-form.test.tsx`

**UserAuthForm (sign up)**

- renders every field and keeps Sign Up disabled until valid
- enables Sign Up for a complete, valid form
- shows a mismatch error for different passwords
- checks email availability after the debounce
- returns to idle when the availability check fails
- does not check availability for an invalid email
- creates the account, signs in, and routes to onboarding
- routes to sign-in when auto sign-in fails
- shows the API error message
- shows a generic error for network failures
- shows the loading state and disables fields
- toggles both password fields
- links back to sign-in


### `components/forms/__tests__/verify-code-form.test.tsx`

**VerifyCodeForm**

- renders the code field and submit button
- rejects a code shorter than six digits
- rejects a code longer than six digits
- verifies the code and routes to reset-password
- shows the API error message
- shows a generic error for network failures
- shows the loading state and disables the field
- posts an empty email when the query has none


### `app/(dashboard)/forget/__tests__/page.test.tsx`

**Forgot-password page**

- renders the heading, description, form, and copyright
- renders the light logo for the light theme
- renders the dark logo and toggles back to light
- toggles from light to dark


### `app/(dashboard)/reset-password/__tests__/page.test.tsx`

**Reset-password page**

- renders the heading, description, form, and copyright
- renders the light logo for the light theme
- renders the dark logo and toggles back to light
- toggles from light to dark


### `app/(dashboard)/signup/__tests__/page.test.tsx`

**Signup page**

- renders the form and the light logo
- switches to the dark theme
- renders the dark logo and switches back to light
- uses the dark logo for the system theme


### `app/(dashboard)/verify-code/__tests__/page.test.tsx`

**Verify-code page**

- renders the heading, description, form, and copyright
- renders the light logo for the light theme
- renders the dark logo and toggles back to light
- toggles from light to dark


### `app/(dashboard)/signin/__tests__/page.test.tsx`

**Sign-in page**

- renders the sign-in screen


### `components/pages/sign-in/__tests__/sign-in.test.tsx`

**SignIn screen**

- renders the form, resume link, and light logo
- switches from light to dark
- renders the dark logo and switches back to light
- renders unauthenticated visitors without redirecting
- resolves a redirect for an authenticated visitor with a callbackUrl

## Security regressions covered

- **Reset requires proof of verification** — `/api/reset-password` rejects a request whose signed `resetToken` is missing, expired, or issued for a different email (`401`).
- **No credential material in sign-up responses** — `/api/signup` strips `password`, `resetCode`, and `resetCodeExpiry` before returning the user.
- **No account enumeration on forgot-password** — unknown emails receive the same neutral `200` as known ones, and the resume-onboarding dialog always shows the same confirmation.
- **Route protection** — middleware redirects anonymous users (with a relative `callbackUrl`) and incomplete users to `/onboarding`, while leaving portal routes, static assets, and `/api/*` alone.

## Mocking strategy

- **`next-auth/react`** — `signIn` and `useSession` are spies, so forms and screens run without an auth server.
- **`next-auth/jwt`** — `getToken` is a spy that returns a token or `null`, exercising the middleware matrix without cookies.
- **`next/navigation`** — `useSearchParams` supplies `callbackUrl` / `email` / `token`, and `useRouter` records `push` / `replace`.
- **`next-themes`** — a mutable theme value drives the logo variants and records `setTheme` calls.
- **`axios`** — `post` is mocked for sign-up, forgot, verify, and reset; deferred promises exercise loading states.
- **`fetch`** — covers email availability (`/api/check-email`) and the resume-link POST.
- **Prisma** — `@prisma/client` is mocked with a constructible class (route modules call `new PrismaClient()`), and `@/lib/prisma` supplies the same spies for `check-email`.
- **`next/server`** — middleware tests build real `NextRequest` objects and assert on `NextResponse` headers (`location`, `x-middleware-next`, `x-pathname`).
- **Child components** — Google sign-in and the resume link are stubbed inside form tests so each form is tested in isolation.

## Coverage boundaries

- These are client/route-handler tests. A real Google OAuth round trip and real SMTP delivery are out of scope.
- Successful sign-in assigns `window.location.href`; jsdom cannot perform the navigation, so tests assert the resolver/`signIn` call and rendered state rather than the final page.
- The Playwright suite is the only place a real session cookie and middleware run end to end.
- The NextAuth runtime (`lib/auth-options.ts`), the role-aware landing route (`/api/teammates/landing`), the authenticated password/email change flows, and the email libraries are not covered yet — see below.

## Remaining test gaps

Prioritised candidates, highest risk first.

### P0 — session and account security

| Candidate | Why it matters |
| --------- | -------------- |
| `lib/auth-options.ts` → `authorize()` | Credentials sign-in: missing/blank fields, email normalization, unknown user, OAuth-only user with no password, wrong password, success, and database failure. Mock `prisma` and `bcrypt.compare`. |
| `lib/auth-options.ts` → `jwt` / `session` callbacks | The `onboardingComplete` latch (completed wizard, active teammate, deactivated teammate), Google email → database id mapping, org-name/email backfills, and latch survival across calls. |
| `lib/auth-options.ts` → `signIn` callback | First Google sign-in creates the user plus organization; an existing provider switch is persisted; a notification-email failure never blocks login. |
| `app/api/teammates/landing/route.ts` | The Destination both sign-in forms use: unauthenticated → `/signin`, advisor → `/dashboard`, collaborator → `/benefits`, access lookup failure fails open to `/benefits`. |
| `app/api/profile/change-password/route.ts` | Current-password proof, length bounds, hashing, Google/OAuth users with no password, confirmation email best-effort, and 401/404/500 paths. |
| Password-change UI | `components/pages/settings/password-change-section.tsx` plus the Google-account alternative in `google-account-section.tsx`. |

### P1 — email and session configuration

| Candidate | Why it matters |
| --------- | -------------- |
| `lib/email.ts` | `sendSignInNotificationEmail`, `sendPasswordChangedConfirmationEmail`, and any other auth mail; assert recipient/subject/body and that SMTP errors are swallowed where callers require it. |
| `lib/sendResetEmail.ts` | Reset mail composition: code, `/verify-code?email=…` URL, subject, and R2-hosted logo fallbacks. Mock `nodemailer` and `@/lib/branding-r2`. |
| Email-change verification routes | `profile/send-email-verification`, `profile/verify-email-change`, and `profile/clear-email-verification` — token/code validation and ownership checks. |
| Auth cookie/session config | Assert `authOptions.cookies.sessionToken` names/options and the 8-hour `maxAge` so the middleware cookie-name mirror cannot drift. |

### P2 — end-to-end depth

| Candidate | Why it matters |
| --------- | -------------- |
| Full reset journey | Seed a known reset code (or expose one only under test), then Playwright: forgot → verify → reset → sign in with the new password. This is the one critical path `e2e/auth.spec.ts` cannot assert without inbox access. |
| Sign-up → onboarding | Create a disposable account, confirm it auto-signs in, completes or resumes onboarding, then clean it up. |
| Google OAuth | Only with a dedicated Google test identity; otherwise keep the current button/unit coverage. |
| Mobile sign-in layout | Low risk; the onboarding suite already covers the desktop-only gate. |

## Hardening findings (fix before testing them)

These are open defects, not test gaps. Each one needs a code change (and, where
noted, a product decision) before a regression test can be written. Do not add
tests that lock in the current unsafe behaviour.

### 1. Reset-code brute force — **open**

**Where:** [`app/api/forget/route.ts`](../../app/api/forget/route.ts:28) issues a
6-digit code with a **24-hour** expiry; [`app/api/verify-code/route.ts`](../../app/api/verify-code/route.ts:22)
accepts unlimited guesses.

**Risk:** one million candidates over 24 hours is trivially enumerable, so
anyone who knows an email can take over the account.

**Fix:**
1. Add `resetCodeAttempts Int @default(0)` (and optionally
   `resetCodeSentAt DateTime?` for resend throttling) to `User`, with a
   migration.
2. Issue the code with a **15-minute** TTL and reset `resetCodeAttempts` to `0`
   whenever a new code is issued.
3. In `verify-code`, increment the counter atomically on every wrong guess.
   After **5** failures, clear the code and return `429` with `Retry-After`.
   On success, clear the code, expiry, and counter.
4. Throttle resend requests (for example one per 60 seconds per account).

**Tests to add once fixed:** counter increments, lockout after five failures,
correct code clears the counter, expiry is 15 minutes, resend resets the
counter, `429` response shape.

### 2. Reset-token replay — **open**

**Where:** [`lib/reset-token.server.ts`](../../lib/reset-token.server.ts:1) signs
a stateless JWT valid for 10 minutes; [`app/api/reset-password/route.ts`](../../app/api/reset-password/route.ts:18)
only proves that the verification step happened for that email.

**Risk:** a successful reset does not invalidate the token. Anyone holding it
can reset the password again until the 10-minute expiry, including after the
legitimate owner has chosen a new password.

**Fix:** bind the token to the password it was issued against. Add a fingerprint
(e.g. `sha256(user.password ?? "")`) to the JWT payload when `verify-code`
issues it, and have `reset-password` compare that fingerprint with the user's
current hash before updating. The update changes the hash, so the old token can
no longer match. If strict single-use inside the same password is required, add
a one-time `jti` store instead.

**Tests to add once fixed:** first reset succeeds, replay returns `401`, a token
issued before a reset is rejected afterwards, and tokens remain bound to their
email.

### 3. Sign-up without email verification — **decision required**

**Where:** [`app/api/signup/route.ts`](../../app/api/signup/route.ts:1) creates
the account and [`components/forms/user-signup-form.tsx`](../../components/forms/user-signup-form.tsx:1)
immediately signs the user in.

**Risk:** anyone can register an address they do not control, and typos create
unreachable accounts.

**Fix:** either accept the risk explicitly in this document, or add a pending
state: `emailVerifiedAt DateTime?`, a verification email with a single-use
expiring token, a resend endpoint, and a sign-in gate in `authorize()` /
the `signIn` callback for unverified credentials accounts.

**Tests to add once fixed (if verification is adopted):** sign-up leaves the
account unverified, sign-in is refused until verified, the token is single-use
and expiring, and resend is throttled.

### 4. Password change does not revoke sessions — **decision required**

**Where:** [`app/api/profile/change-password/route.ts`](../../app/api/profile/change-password/route.ts:68)
updates the hash; [`lib/auth-options.ts`](../../lib/auth-options.ts:124) keeps
existing JWTs valid for their full 8-hour lifetime.

**Risk:** a stolen session stays usable after the owner changes the password.
The same applies to a password reset.

**Fix:** add `passwordChangedAt DateTime?` (or an integer token version) to
`User`, update it on password change and reset, copy it into the JWT in the
`jwt` callback, and compare it on every call. Mismatches should clear the token
so the user is forced to sign in again. If the current behaviour is intentional,
document that decision here instead.

**Tests to add once fixed:** a JWT issued before the change is rejected, the
new password can sign in, and a reset also invalidates prior sessions.

See [`testing.md`](testing.md) for shared conventions and [`onboarding-tests.md`](onboarding-tests.md) for the onboarding inventory.
