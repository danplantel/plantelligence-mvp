import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  getMarketingOrigin,
  isMarketingHost,
  requestHostFromHeaders,
} from "@/lib/marketing/host";

export const dynamic = "force-dynamic";

/**
 * The marketing site is a single scroll page plus the two public Platform legal
 * pages. Other hosts return an empty sitemap: portal and dashboard URLs are not
 * part of the public site and must not be advertised to crawlers.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const host = requestHostFromHeaders(headers());
  if (!host || !isMarketingHost(host)) return [];

  const origin = getMarketingOrigin();
  const lastModified = new Date();

  return [
    {
      url: origin,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${origin}/legal/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${origin}/legal/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
