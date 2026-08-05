/** @type {import('next').NextConfig} */
const nextConfig = {
  // chroma-js is a pure ESM package that needs to be transpiled by Next.js
  // for the production build to correctly handle its default export.
  transpilePackages: ["chroma-js"],

  // @sparticuz/chromium contains a bin/ directory with the Chromium binary.
  // Webpack must NOT bundle this package — it must remain as an external
  // require so the binary path stays resolvable at runtime on Vercel.
  // puppeteer-core is also externalized to avoid bundling its internals.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  // Vercel's output file tracing (NFT) follows the JS import graph.  The
  // @sparticuz/chromium package loads Brotli-compressed binaries from its
  // bin/ directory via fs operations at runtime, which the tracer cannot
  // detect.  Without this, Vercel strips bin/ and chromium.executablePath()
  // fails with "input directory ... does not exist".
  experimental: {
    outputFileTracingIncludes: {
      "/api/extract-site-colors": [
        "./node_modules/@sparticuz/chromium/bin/**",
      ],
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
