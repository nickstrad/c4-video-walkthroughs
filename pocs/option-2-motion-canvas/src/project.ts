import {makeProject} from '@motion-canvas/core';
import queryFlow from './scenes/queryFlow?scene';
// Assembled by scripts/narrate.mjs from the committed per-scene ElevenLabs takes.
import narration from '../narration/track.wav';

export default makeProject({
  scenes: [queryFlow],
  audio: narration,
});
