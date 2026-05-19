#!/usr/bin/env bun

import { resolve, join, relative } from "path";
import { chmodSync, readdirSync, realpathSync } from "fs";
import type { BunPlugin } from "bun";

const cliRoot = resolve(import.meta.dir);
const repoRoot = resolve(cliRoot, "../..");

const outfile = process.argv[2] || join(cliRoot, "diffgotchi");

function findInBunModules(pattern: string): string {
  const bunDir = join(repoRoot, "node_modules", ".bun");
  const match = readdirSync(bunDir).find((d) => d.startsWith(pattern));
  if (!match) throw new Error(`Not found in .bun: ${pattern}`);
  return join(bunDir, match, "node_modules");
}

function findNativePackage(platform: string, arch: string): string {
  const modDir = findInBunModules(`@opentui+core-${platform}-${arch}@`);
  return join(modDir, "@opentui", `core-${platform}-${arch}`, "index.ts");
}

const nativeResolverPlugin: BunPlugin = {
  name: "opentui-native-resolver",
  setup(build) {
    const pattern = /^@opentui\/core-(darwin|linux|win32)-(arm64|x64)\/index\.ts$/;
    build.onResolve({ filter: pattern }, (args) => {
      const match = args.path.match(pattern);
      if (!match) return;
      return { path: findNativePackage(match[1], match[2]) };
    });
  },
};

const coreModDir = findInBunModules("@opentui+core@");
const parserWorker = realpathSync(join(coreModDir, "@opentui", "core", "parser.worker.js"));
const workerRelativePath = relative(repoRoot, parserWorker).replaceAll("\\", "/");
const bunfsRoot = "/$bunfs/root/";

const result = await Bun.build({
  entrypoints: [join(cliRoot, "src/main.tsx"), parserWorker],
  plugins: [nativeResolverPlugin],
  compile: {
    outfile,
  },
  define: {
    OTUI_TREE_SITTER_WORKER_PATH: JSON.stringify(bunfsRoot + workerRelativePath),
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

chmodSync(outfile, 0o755);
console.log(`Built: ${outfile}`);
