import {makeProject} from '@motion-canvas/core';
import video from './scenes/video?scene';
// The whole narration as one track, mixed by core (`c4v build`); it starts at
// frame 0 and is padded 1 s past the end because the exporter muxes -shortest.
import track from '@c4v-project/build/track.wav';

export default makeProject({
  scenes: [video],
  audio: track,
});
