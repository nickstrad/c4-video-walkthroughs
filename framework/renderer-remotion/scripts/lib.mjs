// Shared by prepare/render/stills: paths, the one-bundle-many-renders flow,
// and the render settings (also in remotion.config.ts for ad-hoc CLI runs).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = resolve(HERE, "out");
export const PROPS = resolve(OUT, "props.json");
export const SERVE = resolve(OUT, "bundle");
export const COMPOSITION = "Walkthrough";

/** The project directory from argv (default: the litefleet project). */
export const projectDirFrom = (arg) => resolve(arg ?? resolve(HERE, "../projects/litefleet"));

export function readBundle(projectDir) {
  const file = resolve(projectDir, "build/bundle.json");
  if (!existsSync(file)) throw new Error(`${file} is missing: run \`node core/bin/c4v.ts build <projectDir>\` first`);
  const bundle = JSON.parse(readFileSync(file, "utf8"));
  if (bundle.schema !== "c4v-bundle/1") throw new Error(`${file}: schema ${bundle.schema}, expected c4v-bundle/1`);
  const track = resolve(projectDir, "build", bundle.timeline.audio.file);
  if (!existsSync(track)) throw new Error(`${track} is missing: run \`node core/bin/c4v.ts build <projectDir>\` (no network)`);
  return bundle;
}

export function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: HERE, stdio: "inherit" });
}

const remotion = resolve(HERE, "node_modules/.bin/remotion");

/** Bundle once (webpack); renders and stills reuse it. Public dir = <project>/build. */
export function bundleFor(projectDir) {
  run(remotion, ["bundle", "src/index.ts", `--out-dir=${SERVE}`, `--public-dir=${resolve(projectDir, "build")}`, "--log=warn"]);
}

/** Render settings: required --concurrency=2 on the shared 4 vCPU / 8 GB box. */
export const RENDER_FLAGS = [
  `--props=${PROPS}`, "--concurrency=2", "--codec=h264", "--crf=28", "--image-format=jpeg",
  "--audio-codec=aac", "--audio-bitrate=128k", "--log=warn",
];

export const remotionCli = (args) => run(remotion, args);
