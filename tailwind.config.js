/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./constants/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Manrope",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        manrope: ["Manrope", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        // Portal typography theme roles (see lib/typography-themes.ts).
        // `--font-headline` / `--font-body` / `--font-ui` default to the legacy
        // DM Serif / Red Hat / Manrope stacks at :root (see app/globals.css) and
        // are overridden per-plan by the portal container, so the dashboard and
        // every non-portal surface render exactly as before.
        "dm-serif": ["var(--font-headline)", "DM Serif Display", "serif"],
        "red-hat": ["var(--font-body)", "Red Hat Display", "sans-serif"],
        "portal-ui": ["var(--font-ui)", "Outfit", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          blue: "var(--accent-blue)",
          "blue-light": "var(--accent-blue-light)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      /**
       * Every radius utility is a MULTIPLE of one base value.
       *
       * The portal publishes its typography theme's corner treatment as
       * `--portal-radius` (see lib/typography-themes.ts); the dashboard does not
       * set it, so it falls back to the app's `--radius` (0.5rem) and every
       * surface keeps the exact radii it has today:
       *   sm 0.25rem · md 0.375rem · lg 0.5rem · xl 0.75rem · 2xl 1rem · 3xl 1.5rem
       *
       * Scaling by a multiple (rather than adding a constant) is what lets a
       * `sharp` theme reach EXACTLY 0px on every step — an `+4px` xl would have
       * stayed 4px square-ish rather than square.
       *
       * `full` stays circular: avatars, pills and status dots are shapes, not
       * corners, and must not be squared off by a sharp theme.
       */
      borderRadius: {
        none: "0px",
        sm: "calc(var(--portal-radius, var(--radius)) * 0.5)",
        DEFAULT: "calc(var(--portal-radius, var(--radius)) * 0.75)",
        md: "calc(var(--portal-radius, var(--radius)) * 0.75)",
        lg: "var(--portal-radius, var(--radius))",
        xl: "calc(var(--portal-radius, var(--radius)) * 1.5)",
        "2xl": "calc(var(--portal-radius, var(--radius)) * 2)",
        "3xl": "calc(var(--portal-radius, var(--radius)) * 3)",
        full: "9999px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-glow-light": {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(35, 145, 156, 0.4)",
          },
          "50%": {
            transform: "scale(1.1)",
            boxShadow: "0 0 0 8px rgba(35, 145, 156, 0)",
          },
        },
        "pulse-glow-dark": {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(100, 210, 220, 0.4)",
          },
          "50%": {
            transform: "scale(1.1)",
            boxShadow: "0 0 0 8px rgba(100, 210, 220, 0)",
          },
        },
        /**
         * Brand-color extraction sequence (see BrandColorsSection).
         *
         * `logo-scan` sweeps the 2px line from the top of the frame to the bottom and
         * fades at both ends, so the loop reads as a repeating pass rather than a line
         * jumping back to the start. It runs `infinite` because the pass has to continue
         * for as long as the request is in flight.
         */
        "logo-scan": {
          "0%": { top: "0%", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
        "fade-in-soft": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        /** Slight overshoot, so a swatch lands rather than just appearing. */
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        /**
         * The browser outline in "Checking your website…". Shapes carry `pathLength={1}`
         * with a matching `stroke-dasharray`, so `browser-draw` measures each stroke with
         * one unit of dash offset and draws it on; `browser-url` runs the same trick past
         * both ends to loop the URL bar as if the page were still loading.
         */
        "browser-draw": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        "browser-url": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "-1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow-light": "pulse-glow-light 3s ease-in-out infinite",
        "pulse-glow-dark": "pulse-glow-dark 3s ease-in-out infinite",
        "logo-scan": "logo-scan 1.5s ease-in-out infinite",
        "fade-in-soft": "fade-in-soft 0.45s ease-out both",
        "pop-in": "pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "browser-draw": "browser-draw 0.7s ease-out both",
        "browser-url": "browser-url 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
