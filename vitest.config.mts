import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
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
      "@": rootDir,
      "@video-steps": fileURLToPath(new URL("./lib/video-steps", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    setupFiles: ["./vitest.setup.ts"],
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
