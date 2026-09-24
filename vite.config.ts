// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import type { ConfigEnv, PluginOption } from "vite";
import { defineConfig as lovableConfig } from "@lovable.dev/vite-tanstack-config";

export default async (env: ConfigEnv) => {
  const resolvedFn = lovableConfig({
    tanstackStart: {
      server: { entry: "server" },
    },
    nitro: { preset: "node-server" },
  });
  const config = await resolvedFn(env);
  if (Array.isArray(config.plugins)) {
    config.plugins = (config.plugins as PluginOption[]).flat(Infinity).filter((p) => {
      if (p && typeof p === "object" && "name" in p) {
        return p.name !== "@tanstack/devtools:inject-source";
      }
      return Boolean(p);
    });
  }
  return config;
};
