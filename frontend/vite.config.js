import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // host: "0.0.0.0",
    // port: 5173,
    // allowedHosts: [".devtunnels.ms", "all"],
    proxy: {
      "/api": "http://127.0.0.1:8000",
      // "/api": "https://h11bc850-8000.euw.devtunnels.ms",
    },
  },
});
