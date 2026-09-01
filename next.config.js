/** @type {import('next').NextConfig} */

// ── Build / incremental builds ──────────────────────────────────────────────
// package.json's "build" script clears .next before every build:
//   node -e "require('fs').rmSync('.next',{recursive:true,force:true})" && next build
// This avoids a Next.js 14 incremental-build bug where, after deleting or
// renaming source files, the trace collector fails with:
//   Error: ENOENT ... .next/server/pages/_error.js.nft.json
//
// To KEEP / START INCREMENTAL (faster) builds instead:
//   1. Change package.json "build" back to just:   "next build"
//   2. Subsequent builds will reuse .next and be faster.
//   3. If you hit the _error.js.nft.json ENOENT error again, delete .next once
//      (e.g. `rm -rf .next` on macOS/Linux, `rd /s /q .next` on Windows) and rebuild.
//
// NOTE: don't "work around" that error by removing experimental.outputFileTracingIncludes
// below — it is required to include ./chromium-bin/** in the output trace so the
// Chromium binaries ship to Vercel for /api/extract-site-colors.
const nextConfig = {
  // chroma-js is a pure ESM package that needs to be transpiled by Next.js
  // for the production build to correctly handle its default export.
  transpilePackages: ["chroma-js"],

  // The postinstall script copies @sparticuz/chromium/bin/ → chromium-bin/
  // at the project root.  Vercel's output file tracer (NFT) can't follow
  // import.meta.url-relative paths inside node_modules, but project-root
  // directories are always included.  This ensures the Brotli-compressed
  // Chromium binaries are available at runtime.
  experimental: {
    // @sparticuz/chromium must be externalized so webpack doesn't bundle it
    // (bundling rewrites import.meta.url which breaks internal path resolution).
    // Note: serverExternalPackages is Next.js 15+ only. For Next.js 14.x,
    // use experimental.serverComponentsExternalPackages instead.
    serverComponentsExternalPackages: ["@sparticuz/chromium"],

    outputFileTracingIncludes: {
      "/api/extract-site-colors": ["./chromium-bin/**"],
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  env: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN || "plantel.pro",
    // NEXTAUTH_URL intentionally not exposed — NextAuth client uses window.location.origin
  },
  async headers() {
    return [
      {
        // Allow the dashboard (plantel.pro) and portal subdomains
        // (*.plantel.pro) to call API routes from one another.
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://*.plantel.pro",
          },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ];
  },
  // allowHosts: normally "*" via wildcard DNS; explicit for local testing
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }

    config.module.rules.push({
      test: /\.html$/,
      type: "asset/resource",
    });

    return config;
  },
};

module.exports = nextConfig;
