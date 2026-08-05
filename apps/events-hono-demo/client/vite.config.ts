import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: [
      "dev-source",
      "development",
      "browser",
      "module",
      "import",
      "default",
    ],
  },
  server: {
    port: 3011,
    proxy: {
      "/api": "http://localhost:3010",
    },
  },
});
