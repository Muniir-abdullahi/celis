import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const nextRoot = join(require.resolve("next/package.json"), "..");
const version = JSON.parse(readFileSync(join(nextRoot, "package.json"), "utf8")).version;

if (version !== "16.3.6") {
  throw new Error(`Review the _global-error build patch for Next.js ${version}`);
}

const file = join(nextRoot, "dist", "build", "utils.js");
const source = readFileSync(file, "utf8");
const startMarker = "// Skip page data collection for synthetic _global-error routes";
const endMarker = "\n    await (0, _createincrementalcache.createIncrementalCache)";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("Next.js _global-error build code has changed; review the patch");
}

const section = source.slice(start, end);
const before = "appConfig: {}";
const after = "appConfig: { revalidate: 0 }";

if (section.includes(after)) {
  console.log("Next.js _global-error build patch already applied");
} else if (section.split(before).length === 2) {
  const updated = source.slice(0, start) + section.replace(before, after) + source.slice(end);
  writeFileSync(file, updated);
  console.log("Patched Next.js _global-error prerender classification");
} else {
  throw new Error("Next.js _global-error build code has changed; review the patch");
}
