import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  getMarketingOrigin,
  isMarketingHost,
  requestHostFromHeaders,
} from "@/lib/marketing/host";

export const dynamic = "force-dynamic";

/**
 * The marketing site is a single scroll page, so its sitemap has one entry.
 * Other hosts return an empty sitemap: portal and dashboard URLs are not part
 * of the public site and must not be advertised to crawlers.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const host = requestHostFromHeaders(headers());
  if (!host || !isMarketingHost(host)) return [];

  return [
    {
      url: getMarketingOrigin(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
