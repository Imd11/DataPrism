import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    server: {
      host: "::",
      port: 8080,
      // Avoid ENOSPC (file watcher limit) by ignoring heavy backend/venv directories.
      watch: {
        ignored: [
          "**/backend/.venv/**",
          "**/.data-weaver/**",
          "**/node_modules/**",
          "**/dist/**",
        ],
      },
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("error", (err: any, _req: any, res: any) => {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
              }
              res.end(
                JSON.stringify({
                  detail: "Backend proxy error. Is the API running?",
                  target: apiTarget,
                  error: String(err?.message ?? err),
                }),
              );
            });
          },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      // Generates bundle inspection artifacts on build.
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
      visualizer({
        filename: "dist/stats.raw-data.json",
        template: "raw-data",
        gzipSize: true,
        brotliSize: true,
      }),
      visualizer({
        filename: "dist/stats.list.yml",
        template: "list",
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            // Keep the entry chunk lean by splitting heavy, rarely-needed libs.
            if (id.includes("@xyflow/react") || id.includes("@xyflow/system")) return "xyflow";
            if (id.includes("recharts") || id.includes("victory-vendor")) return "recharts";
            if (id.includes("framer-motion") || id.includes("motion-dom")) return "motion";

            // Framework / routing
            if (id.includes("@remix-run/router") || id.includes("react-router")) return "react-router";
            if (id.includes("react")) return "react";

            // State / data
            if (id.includes("zustand")) return "zustand";
            if (id.includes("@tanstack/")) return "tanstack";

            // UI kits can be chunky
            if (id.includes("@radix-ui/")) return "radix";

            // Common UI/utility deps
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("date-fns")) return "date";
            if (id.includes("zod")) return "zod";
            if (id.includes("react-hook-form") || id.includes("@hookform/")) return "forms";
            if (id.includes("/lodash/")) return "lodash";
            if (id.includes("@floating-ui/")) return "floating-ui";
            if (id.includes("sonner")) return "sonner";
            if (id.includes("decimal.js-light")) return "decimal";
            if (id.includes("fast-equals")) return "fast-equals";
            if (id.includes("eventemitter3")) return "eventemitter";

            // small but widely used helpers
            if (id.includes("clsx") || id.includes("tailwind-merge") || id.includes("class-variance-authority")) {
              return "ui-utils";
            }

            return "vendor";
          },
        },
      },
    },
  };
});
