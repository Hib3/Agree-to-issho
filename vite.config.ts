import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/Agree-to-issho/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["assets/characters/main/fullbody/approved/aguri_normal.png"],
      manifest: {
        name: "アグリといっしょ",
        short_name: "アグリといっしょ",
        description: "言葉を教えて一緒に暮らす、完全オフライン会話ゲーム",
        theme_color: "#71537f",
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
        globPatterns: ["**/*.{js,css,html,png,json,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: { cacheName: "aguri-approved-assets-v1" }
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
