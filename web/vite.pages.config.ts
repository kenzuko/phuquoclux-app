import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const webDir = fileURLToPath(new URL(".", import.meta.url));

/**
 * Isolated static review build. Does not import Cloudflare's Vite plugin or
 * ship the server/checkout implementation. The normal app remains untouched.
 */
export default defineConfig({
  root: resolve(webDir, "pages-preview"),
  publicDir: resolve(webDir, "public"),
  base: "/phuquoclux-app/next/",
  define: {
    "import.meta.env.VITE_PAGES_PREVIEW": JSON.stringify("1"),
  },
  build: {
    outDir: resolve(webDir, "dist-pages"),
    emptyOutDir: true,
    target: "es2022",
  },
});
