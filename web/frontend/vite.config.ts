import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, "src");
const notraUi = path.resolve(src, "vendor/notra-ui");

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: [
      { find: "@notra/ui/globals.css", replacement: path.resolve(notraUi, "styles/globals.css") },
      { find: "@notra/ui/cta-button.css", replacement: path.resolve(notraUi, "styles/cta-button.css") },
      { find: "@notra/ui/motion.css", replacement: path.resolve(notraUi, "styles/motion.css") },
      { find: "@notra/ui/status.css", replacement: path.resolve(notraUi, "styles/status.css") },
      { find: "@notra/ui/text-shimmer.css", replacement: path.resolve(notraUi, "styles/text-shimmer.css") },
      { find: /^@notra\/ui\/(.*)$/, replacement: path.resolve(notraUi, "$1") },
      { find: /^@notra\/schemas\/(.*)$/, replacement: path.resolve(src, "vendor/notra-schemas/$1") },
      { find: /^@notra\/utils\/(.*)$/, replacement: path.resolve(src, "vendor/notra-utils/$1") },
      { find: "next/image", replacement: path.resolve(src, "shims/next-image.tsx") },
      { find: "next/link", replacement: path.resolve(src, "shims/next-link.tsx") },
      { find: "@", replacement: src + "/" },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8000",
      "/static": "http://localhost:8000",
    },
  },
});
