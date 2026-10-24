// Dumb views: no storyboard caption, label or title may be typed into this
// renderer's source; it must come from the bundle (core's shared lint).
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { hardCodedText } from "../../core/src/verify/dumb-views.ts";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

for (const project of ["litefleet", "litefleet-arc"]) {
  test(`no ${project} storyboard text is hard-coded in the renderer`, () => {
    assert.deepEqual(hardCodedText(here(`../../projects/${project}`), [here("../src"), here("../scripts")]), []);
  });
}
