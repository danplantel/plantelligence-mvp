import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// This file lives in `config/vitest/`. Every path below therefore reaches back
// up to the repository root from `import.meta.url` instead of relying on the
// config file's own directory — `@` has to keep pointing at the repo root, not
// at `config/vitest/`. `root` is pinned to that same directory so `include`,
// `exclude`, and `coverage` globs keep resolving from the repo root exactly as
// they did when this file lived there.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: repoRoot,
  // tsconfig uses `jsx: "preserve"` for Next.js, so tell the test transformer
  // to use the automatic React runtime instead of leaving JSX untouched.
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      // Mirrors the `paths` entries in tsconfig.json.
      "@": repoRoot,
      "@video-steps": fileURLToPath(
        new URL("../../lib/video-steps", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    // Absolute, so the setup file keeps resolving from the repo root even
    // though this config now lives two directories down.
    setupFiles: [
      fileURLToPath(new URL("../../vitest.setup.ts", import.meta.url)),
    ],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/chromium-bin/**",
      "**/e2e/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/__tests__/**",
        "**/*.{test,spec}.{ts,tsx}",
        "**/.next/**",
      ],
    },
  },
});
