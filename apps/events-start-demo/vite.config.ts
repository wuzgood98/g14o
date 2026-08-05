import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3030,
  },
  resolve: {
    tsconfigPaths: true,
    conditions: [
      "dev-source",
      "development",
      "browser",
      "module",
      "import",
      "default",
    ],
  },
  ssr: {
    resolve: {
      conditions: [
        "dev-source",
        "development",
        "node",
        "module",
        "import",
        "default",
      ],
    },
  },
  plugins: [tanstackStart(), react()],
});
