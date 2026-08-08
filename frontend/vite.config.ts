import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // country-state-city ships a ~150k-row world city dataset. It's
        // only ever reached via a dynamic import() (see
        // utils/indianRegions.ts), but Rollup's default chunking still
        // pulled it into the main entry bundle instead of splitting it out
        // — forcing it into its own chunk here keeps it out of the initial
        // page load for every visitor who never opens a location dropdown.
        manualChunks(id) {
          if (id.includes("node_modules/country-state-city")) {
            return "country-state-city";
          }
        },
      },
    },
  },
});
