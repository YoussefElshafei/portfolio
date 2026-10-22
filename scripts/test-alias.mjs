/**
 * Lets `node --test` resolve the "@/..." import alias from tsconfig.json, so
 * tests can load real data modules (the chatbot's knowledge base imports the
 * project and profile data) rather than fixtures. Test-only; Next resolves the
 * alias itself in the app.
 */
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync } from "node:fs";
      import { fileURLToPath, pathToFileURL } from "node:url";
      const SRC = ${JSON.stringify(new URL("../src/", import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          const base = new URL(specifier.slice(2), SRC);
          for (const ext of [".ts", ".tsx", "/index.ts"]) {
            const url = new URL(base.href + ext);
            if (existsSync(fileURLToPath(url))) return next(url.href, context);
          }
        }
        return next(specifier, context);
      }
    `),
);
