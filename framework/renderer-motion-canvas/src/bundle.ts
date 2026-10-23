// The render bundle: the renderer's only input besides the narration track.
import json from '@c4v-project/build/bundle.json';
import {BUNDLE_SCHEMA, type RenderBundle} from '../../core/src/index.ts';

export const bundle = json as unknown as RenderBundle;
if (bundle.schema !== BUNDLE_SCHEMA) throw new Error(`bundle schema ${bundle.schema}, expected ${BUNDLE_SCHEMA}`);
