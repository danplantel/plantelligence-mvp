import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  getMarketingOrigin,
  isMarketingHost,
  requestHostFromHeaders,
} from "@/lib/marketing/host";

/**
 * Only the marketing origin is crawlable. The app origin serves authenticated
 * workspaces and participant portals, so it is explicitly disallowed rather
 * than relying on auth redirects to keep it out of search results.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const site = getMarketingOrigin();
  const host = requestHostFromHeaders(headers());

  if (!host || !isMarketingHost(host)) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/signin",
          "/signup",
          "/onboarding",
          "/accept-invite",
          "/settings",
          "/clients",
          "/benefits",
          "/documents",
          "/communications",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
