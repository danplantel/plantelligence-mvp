/** @type {import('next').NextConfig} */
const nextConfig = {
  // chroma-js is a pure ESM package that needs to be transpiled by Next.js
  // for the production build to correctly handle its default export.
  transpilePackages: ["chroma-js"],

  // @sparticuz/chromium ships a bin/ directory with Brotli-compressed
  // Chromium binaries.  This package MUST be externalized so webpack does
  // not bundle it — if bundled, import.meta.url is rewritten and the
  // relative path to bin/ breaks.  Vercel preserves the full package
  // directory for externalized packages (Pro plan: 250 MB limit).
  serverExternalPackages: ["@sparticuz/chromium"],

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
