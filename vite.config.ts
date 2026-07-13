import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

const gitSha = process.env.GITHUB_SHA ?? (() => {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/Agree-to-issho/",
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(gitSha.slice(0, 12)),
    "import.meta.env.VITE_GIT_SHA": JSON.stringify(gitSha)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "アグリといっしょ",
        short_name: "アグリといっしょ",
        description: "言葉を教えて一緒に暮らす、完全オフライン会話ゲーム",
        theme_color: "#f3eadc",
        background_color: "#f3eadc",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: "assets/characters/main/fullbody/approved/aguri_normal.png",
            sizes: "640x959",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,webp,json,woff2}"],
        globIgnores: ["assets/characters/main/fullbody/approved/aguri_normal.png"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: { cacheName: "aguri-approved-assets-v3" }
          }
        ]
      }
    })
  ],
  server: { host: "127.0.0.1", port: 5173 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"]
  }
});
