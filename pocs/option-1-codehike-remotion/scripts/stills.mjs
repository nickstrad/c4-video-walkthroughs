// Renders the key-moment stills named here into frames/ (via the Remotion CLI).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const here = new URL("..", import.meta.url).pathname;
const story = JSON.parse(readFileSync(here + "storyboard.json", "utf8"));
const code = story.scenes.find((s) => s.id === "code");
const stepStart = (id) => {
  let t = code.start + code.intro;
  for (const s of code.steps) { if (s.id === id) return t; t += s.duration; }
};
const moments = [
  ["01-overview", 2.5],                       // whole C4 view, title up
  ["02-focus-zoom", 8.0],                      // nd-engine lit, camera in
  ["03-code-wait", stepStart("wait") + 1.5],   // code scene, lane-wait step lit
  ["04-code-node", stepStart("node") + 1.5],   // node slot / 503 step lit
];
for (const [name, t] of moments) {
  execFileSync("npx", ["remotion", "still", "src/index.ts", "Walkthrough", `frames/${name}.png`, `--frame=${Math.round(t * story.fps)}`],
    { cwd: here, stdio: "inherit" });
}
