/**
 * Single source for "welcome / banner" copy used in validation and navigation.
 * UI stores hero text on companyBasics; older paths use welcomeStatement or brandImages._meta.
 */

function metaOf(stepData: {
  companyBasics?: { brandImages?: unknown };
}): { heroTitle?: string; heroDescription?: string } | undefined {
  const bi = stepData.companyBasics?.brandImages as
    | { _meta?: { heroTitle?: string; heroDescription?: string } }
    | undefined;
  return bi?._meta;
}

/** First non-empty stored headline (no UI default). Used for step-2 validation. */
export function resolveStoredWelcomeHeadline(stepData: {
  companyBasics?: { heroTitle?: string; brandImages?: unknown };
  welcomeStatement?: { headline?: string };
}): string | null {
  const h = stepData.companyBasics?.heroTitle?.trim();
  if (h) return h;
  const w = stepData.welcomeStatement?.headline?.trim();
  if (w) return w;
  const m = metaOf(stepData)?.heroTitle?.trim();
  if (m) return m;
  return null;
}

/** First non-empty stored body (no UI default). Used for step-2 validation. */
export function resolveStoredWelcomeBody(stepData: {
  companyBasics?: { heroDescription?: string; brandImages?: unknown };
  welcomeStatement?: { bodyText?: string };
}): string | null {
  const h = stepData.companyBasics?.heroDescription?.trim();
  if (h) return h;
  const w = stepData.welcomeStatement?.bodyText?.trim();
  if (w) return w;
  const m = metaOf(stepData)?.heroDescription?.trim();
  if (m) return m;
  return null;
}

export function getWelcomeHeadlineFromStepData(stepData: {
  companyBasics?: {
    companyName?: string;
    heroTitle?: string;
    brandImages?: { _meta?: { heroTitle?: string } };
  };
  welcomeStatement?: { headline?: string };
}): string {
  const cb = stepData.companyBasics;
  const meta = (cb?.brandImages as { _meta?: { heroTitle?: string } } | undefined)?._meta;
  const companyName = (cb?.companyName || "Company Name").trim();
  const defaultHeadline = `Welcome to the ${companyName} Benefits Hub!`;
  const fromHero = cb?.heroTitle?.trim();
  if (fromHero) return fromHero;
  const fromWelcome = stepData.welcomeStatement?.headline?.trim();
  if (fromWelcome) return fromWelcome;
  const fromMeta = meta?.heroTitle?.trim();
  if (fromMeta) return fromMeta;
  return defaultHeadline;
}

export function getWelcomeBodyFromStepData(stepData: {
  companyBasics?: {
    heroDescription?: string;
    brandImages?: { _meta?: { heroDescription?: string } };
  };
  welcomeStatement?: { bodyText?: string };
}): string {
  const cb = stepData.companyBasics;
  const meta = (cb?.brandImages as { _meta?: { heroDescription?: string } } | undefined)?._meta;
  const fromHero = cb?.heroDescription?.trim();
  if (fromHero) return fromHero;
  const fromWelcome = stepData.welcomeStatement?.bodyText?.trim();
  if (fromWelcome) return fromWelcome;
  const fromMeta = meta?.heroDescription?.trim();
  if (fromMeta) return fromMeta;
  return "";
}
