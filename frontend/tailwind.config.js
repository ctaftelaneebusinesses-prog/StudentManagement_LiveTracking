/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary — deep navy, used app-wide for sidebar chrome, headings,
        // links, and default buttons across every portal (admin/teacher/
        // parent/student/driver all draw from this one scale).
        brand: {
          50: "#eef3f9",
          100: "#d8e6f2",
          200: "#b0cce4",
          300: "#82abcf",
          400: "#5688b3",
          500: "#386c95",
          600: "#2a557a",
          700: "#1e3a5f",
          800: "#16283f",
          900: "#0d1826",
        },
        // Accent — teal, the one interactive/active-state color used
        // everywhere (nav active states, buttons, badges) so it never
        // competes with `brand` or with the chart categorical palette
        // (--series-*  in index.css, kept intentionally separate).
        accent: {
          50: "#effbfa",
          100: "#d6f5f2",
          200: "#ade8e3",
          300: "#7ad6cf",
          400: "#3fbcb3",
          500: "#0ea5a0",
          600: "#0b8681",
          700: "#0a6b67",
          800: "#0a5451",
          900: "#073e3c",
        },
        // Student/Parent Portal gender theme (see PortalThemeContext) — additive,
        // only ever used inside [data-portal-theme] scopes; every other portal
        // (admin/teacher/driver) keeps drawing from brand/accent above.
        boy: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#b7dbff",
          300: "#86c2ff",
          400: "#4fa1ff",
          500: "#2f7dfa",
          600: "#1c5fe0",
          700: "#1a4bb5",
          800: "#1b3f8f",
          900: "#1a3671",
        },
        girl: {
          50: "#fdf2fa",
          100: "#fbe4f5",
          200: "#f8caec",
          300: "#f3a4dc",
          400: "#ea72c3",
          500: "#dd4aa8",
          600: "#c22e8a",
          700: "#a02271",
          800: "#831f5d",
          900: "#6f1e4f",
        },
      },
      boxShadow: {
        "card-hover": "0 12px 32px -12px rgba(74, 58, 167, 0.28)",
        "portal-glow": "0 20px 45px -18px var(--portal-glow)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "slide-up": "slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
        float: "float 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
