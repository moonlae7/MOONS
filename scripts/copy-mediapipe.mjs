// Copies the MediaPipe hand-tracking runtime into public/ so the universe can load it from our own domain.
// Runs before dev and build; the files come from node_modules, so no network is needed.
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';

const from = 'node_modules/@mediapipe/tasks-vision/wasm', to = 'public/mediapipe/wasm';
mkdirSync(to, {recursive: true});
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  if (!existsSync(`${from}/${name}`)) throw new Error(`missing ${from}/${name}; run npm install`);
  copyFileSync(`${from}/${name}`, `${to}/${name}`);
}
console.log('mediapipe runtime copied to', to);
