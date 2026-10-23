// Highlights the extracted code with Code Hike in Node (where the theme and
// grammar load from node_modules; in the browser bundle Code Hike would fetch
// the theme from lighter.codehike.org at render time). Each storyboard step
// becomes a Code Hike block annotation "focus" over its range in the snippet.
import { highlight } from "codehike/code";
import { readFileSync, writeFileSync } from "node:fs";

const here = new URL("..", import.meta.url).pathname;
const story = JSON.parse(readFileSync(here + "storyboard.json", "utf8"));
const code = JSON.parse(readFileSync(here + "data/code.json", "utf8"));
const h = await highlight({ value: code.code, lang: "go", meta: "" }, "github-dark");
for (const s of story.scenes.flatMap((sc) => sc.steps ?? []))
  h.annotations.push({
    name: "focus", query: s.id,
    fromLineNumber: s.lines[0] - code.firstLine + 1,
    toLineNumber: s.lines[1] - code.firstLine + 1,
  });
writeFileSync(here + "data/highlighted.json", JSON.stringify(h) + "\n");
console.log(`highlight: ${h.tokens.length} tokens, ${h.annotations.length} focus annotations`);
