/** @type {import('next').NextConfig} */
const nextConfig = {
  // chroma-js is a pure ESM package that needs to be transpiled by Next.js
  // for the production build to correctly handle its default export.
  transpilePackages: ["chroma-js"],

  // @sparticuz/chromium must be externalized so webpack doesn't bundle it
  // (bundling rewrites import.meta.url which breaks internal path resolution).
  serverExternalPackages: ["@sparticuz/chromium"],

  // The postinstall script copies @sparticuz/chromium/bin/ → chromium-bin/
  // at the project root.  Vercel's output file tracer (NFT) can't follow
  // import.meta.url-relative paths inside node_modules, but project-root
  // directories are always included.  This ensures the Brotli-compressed
  // Chromium binaries are available at runtime.
  experimental: {
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
