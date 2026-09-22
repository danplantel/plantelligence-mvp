/** @type {import('next').NextConfig} */

// ── Build / incremental builds ──────────────────────────────────────────────
// INCREMENTAL BUILDS ARE ENABLED: package.json's "build" script is just `next build`,
// so subsequent builds reuse .next and are faster.
//
// Known issue: Next.js 14 can leave .next in a broken state after deleting or
// renaming source files, producing errors like:
//   - Error: ENOENT ... .next/server/pages/_error.js.nft.json
//   - PageNotFoundError: Cannot find module for page: /_document (or /_error, /api/auth/[...nextauth])
// If you hit any of these, delete .next once and rebuild:
//   `rm -rf .next` (macOS/Linux)   |   `rd /s /q .next` (Windows)
// If they become frequent, consider also making sure no stale `next dev`/`next build`
// node processes are running (they lock .next files).
//
// NOTE: don't "work around" these errors by removing experimental.outputFileTracingIncludes
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
    //
    // onnxruntime-node is the same class of problem for /api/remove-background: it
    // resolves a platform-specific .node binding relative to its own package directory,
    // and a bundled copy loses that path. sharp needs no entry — Next.js externalizes it
    // by default.
    serverComponentsExternalPackages: [
      "@sparticuz/chromium",
      "onnxruntime-node",
    ],

    outputFileTracingIncludes: {
      "/api/extract-site-colors": ["./chromium-bin/**"],
      // The background-removal weights are not imported by any module, so the tracer
      // cannot see them; they are read from disk at runtime by path.
      //
      // Whether they ship is decided by whether the file exists at build time: the
      // weights are gitignored, so a Vercel build has none and the route falls back to
      // fetching them into the instance's temp directory. A container build that runs
      // `pnpm run models:fetch` before `next build` carries them inside the image.
      //
      // Measured, so nobody has to rediscover it: this route's trace is ~341 MB with the
      // weights present — 168 MB of model plus 287 MB of onnxruntime-node platform
      // binaries (darwin 85, linux 68, win32 133; the package ships all three and the
      // tracer follows them). ~173 MB of that is foreign-platform binaries, which
      // `experimental.outputFileTracingExcludes` does NOT remove in Next 14.2 — both the
      // `./` and `**/` glob forms were tested against a regenerated trace and changed
      // nothing. Vercel's unzipped function limit is 250 MB, so:
      //
      //   - no `models/` in the build (the default for a git-cloned Vercel build) →
      //     ~173 MB, fits, and the first request per instance downloads the weights to
      //     /tmp once;
      //   - a container, or a function allowance above 341 MB → ship `models/` and skip
      //     that cold-start download entirely.
      "/api/remove-background": ["./models/**"],
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
