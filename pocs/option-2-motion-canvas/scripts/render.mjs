// Unattended render: start the Vite dev server, open the Motion Canvas editor
// in headless Chromium with `?render` (the editor starts a render on load when
// that query is present), wait for the FFmpeg exporter to finish, shut down.
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {existsSync, statSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'output');
const chrome = process.env.CHROME ?? '/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const started = Date.now();
const secs = () => ((Date.now() - started) / 1000).toFixed(1);

const server = await createServer({root, logLevel: 'warn'});
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`[${secs()}s] vite at ${url}`);

const browser = await chromium.launch({executablePath: chrome, args: ['--no-sandbox']});
const page = await browser.newPage({viewport: {width: 1400, height: 900}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});

const target = path.join(outDir, 'project.mp4');
const before = existsSync(target) ? statSync(target).mtimeMs : 0;
await page.goto(`${url}?render`);
await page.waitForSelector('#render[data-rendering]', {timeout: 60_000});
console.log(`[${secs()}s] render started`);
await page.waitForSelector('#render:not([data-rendering])', {timeout: 15 * 60_000});
// The exporter finalizes the MP4 on the server after the last frame.
let last = -1;
for (;;) {
  const now = existsSync(target) && statSync(target).mtimeMs > before ? statSync(target).size : -1;
  if (now > 0 && now === last) break;
  last = now;
  await new Promise(r => setTimeout(r, 1000));
}
console.log(`[${secs()}s] render finished: ${target} (${statSync(target).size} bytes)`);
console.log('output:', readdirSync(outDir).join(', '));
if (errors.length) console.log('browser errors:\n' + errors.join('\n'));
await browser.close();
await server.close();
