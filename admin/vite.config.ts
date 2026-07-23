// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const ADMIN_BASE_PATH = "/soloadmin";
const ADMIN_ASSETS_BASE_URL = "https://soloway-admin.vercel.app/";
const ASSETS_BASE_URL = process.env.NODE_ENV === "production"
  ? ADMIN_ASSETS_BASE_URL
  : `${ADMIN_BASE_PATH}/`;

export default defineConfig({
  vite: {
    base: ASSETS_BASE_URL,
  },
  tanstackStart: {
    router: {
      basepath: ADMIN_BASE_PATH,
    },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
