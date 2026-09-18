/**
 * Minimal ESM resolve hook so the maintenance scripts in `scripts/` can run on
 * Node's built-in TypeScript support without adding a runtime dependency.
 *
 * It teaches Node two things the bundler already knows:
 *  1. the `@/*` path alias from tsconfig.json maps to the project root, and
 *  2. extensionless imports (`./db`) should resolve to `.ts` / `.tsx` files.
 *
 * This is build tooling only — it is never loaded by the Next.js application.
 */

import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const PROJECT_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

/** Extensions probed for an extensionless specifier, in priority order. */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

/** Probe a filesystem path for a concrete module file. */
function probe(basePath) {
  // An exact file match wins, but a directory must fall through to index probing.
  if (existsSync(basePath)) {
    try {
      if (!statSync(basePath).isDirectory()) return basePath;
    } catch {
      /* ignore and continue probing */
    }
  }
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const ext of EXTENSIONS) {
    const candidate = resolvePath(basePath, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1. tsconfig "@/*" alias → project root.
  if (specifier.startsWith("@/")) {
    const target = probe(resolvePath(PROJECT_ROOT, specifier.slice(2)));
    if (target) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }

  // 2. Extensionless relative imports.
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : PROJECT_ROOT;
    const target = probe(resolvePath(dirname(parentPath), specifier));
    if (target) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
