import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    css: false,
    // Node 20+'s own experimental `localStorage` global shadows jsdom's
    // window.localStorage before jsdom can install its own, leaving
    // window.localStorage undefined in every test. Disabling it lets jsdom's
    // real implementation through. See schoolStore.ts, which reads
    // window.localStorage at module load time.
    poolOptions: {
      threads: { execArgv: ["--no-experimental-webstorage"] },
      forks: { execArgv: ["--no-experimental-webstorage"] },
    },
  },
});
