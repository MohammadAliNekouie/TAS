import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png"],
      manifest: {
        name: "تاس — نرم‌افزار حسابداری",
        short_name: "تاس",
        description: "نرم‌افزار حسابداری فارسی، راست‌به‌چپ، قابل نصب و اجرای مستقل (PWA)",
        lang: "fa",
        dir: "rtl",
        start_url: "/",
        display: "standalone",
        background_color: "#f5f3ee",
        theme_color: "#0f6e5c",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App-shell assets (JS/CSS/fonts/images) get cached so the app can
        // launch offline; live data under /api is deliberately NEVER
        // cached (NetworkOnly) since serving stale accounting data would be
        // actively dangerous — offline just means "app opens, but you need
        // a connection to your own backend to see/change data".
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request }) => ["style", "script", "image", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "app-shell" },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
