// Unattended render of a c4v project with Motion Canvas.
//
//   node scripts/render.mjs [projectDir] [out.mp4]
//     projectDir  default ../projects/litefleet (reads build/bundle.json + build/track.wav)
//     out.mp4     default <projectDir>/renders/motion-canvas.mp4
//
// Salvaged from the option-2 POC: start Vite with the Motion Canvas + FFmpeg
// plugins, open the editor in headless Chromium with `?render` (the editor
// starts a render on load when that query is present), wait for
// `#render[data-rendering]` to clear, then for the MP4 to stop growing (the
// exporter finalises it on the server after the last frame). Hardened: project
// and output are arguments, the port is free, there is an overall timeout,
// browser errors fail the run (except the editor's harmless metadata-save
// timeouts, e.g. virtual:settings), and the result is probed against the timeline before it
// is copied out. Env: CHROME (browser binary), C4V_TIMEOUT (s, default 1500).
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import ffprobe from '@ffprobe-installer/ffprobe';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const project = path.resolve(process.argv[2] ?? path.join(root, '../projects/litefleet'));
const out = path.resolve(process.argv[3] ?? path.join(project, 'renders/motion-canvas.mp4'));
const chrome = process.env.CHROME ?? '/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const timeoutS = Number(process.env.C4V_TIMEOUT ?? 1500);
const scratch = path.join(root, 'output');
const target = path.join(scratch, 'project.mp4'); // the exporter names it after the project

const started = Date.now();
const secs = () => ((Date.now() - started) / 1000).toFixed(1);
const log = (m) => console.log(`[${secs()}s] ${m}`);

const bundlePath = path.join(project, 'build/bundle.json');
const trackPath = path.join(project, 'build/track.wav');
for (const f of [bundlePath, trackPath]) {
  if (!existsSync(f)) {
    console.error(`missing ${f}: run \`node framework/core/bin/c4v.ts build ${project}\` first`);
    process.exit(2);
  }
}
const {timeline} = JSON.parse(readFileSync(bundlePath, 'utf8'));

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const {port} = s.address();
      s.close(() => resolve(port));
    });
  });

let server, browser;
async function shutdown() {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
let dying = false;
async function die(msg) {
  if (dying) return;
  dying = true;
  console.error(`[${secs()}s] FAILED: ${msg}`);
  await shutdown();
  process.exit(1);
}
const timer = setTimeout(() => die(`timed out after ${timeoutS} s`), timeoutS * 1000);

async function render() {
  rmSync(target, {force: true});
  mkdirSync(scratch, {recursive: true});
  process.env.C4V_PROJECT = project;
  process.env.C4V_OUTPUT = scratch;
  const port = await freePort();
  server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'warn',
    server: {port, strictPort: true, host: '127.0.0.1'},
  });
  await server.listen();
  const url = `http://127.0.0.1:${port}/`;
  log(`vite at ${url} · project ${project}`);

  browser = await chromium.launch({executablePath: chrome, args: ['--no-sandbox']});
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  // The editor persists metadata (UI settings, project/scene .meta) over Vite's
  // websocket and gives up waiting for the ack after 1 s (MetaFile.saveData).
  // Always seen for virtual:settings, and for the project under load; the render
  // reads the in-memory values, so it is unaffected. Anything else fails the run.
  const HARMLESS = /^Connection timeout when updating metadata for /;
  const fatal = (kind, text) => {
    if (HARMLESS.test(text.replace(/\0/g, ''))) return log(`ignored ${kind}: ${text.split('\n')[0].replace(/\0/g, '')}`);
    die(`browser ${kind}: ${text}`);
  };
  page.on('pageerror', (e) => fatal('pageerror', String(e?.stack ?? e)));
  page.on('console', (m) => {
    if (m.type() === 'error') fatal('console error', m.text());
    else if (m.text().startsWith('[c4v]')) log(m.text());
  });

  await page.goto(`${url}?render`);
  await page.waitForSelector('#render[data-rendering]', {timeout: 120_000});
  log('render started');
  await page.waitForSelector('#render:not([data-rendering])', {timeout: timeoutS * 1000});
  log('frames done; waiting for the exporter to finalise');
  let last = -1;
  for (;;) {
    const now = existsSync(target) ? statSync(target).size : -1;
    if (now > 0 && now === last) break;
    last = now;
    await new Promise((r) => setTimeout(r, 1500));
  }
  clearTimeout(timer);
  await shutdown();
}
try {
  await render();
} catch (e) {
  await die(String(e?.stack ?? e));
}
if (dying) await new Promise(() => {}); // a failure is already shutting down and exiting

// Probe: H.264 + AAC, the bundle's size, and the timeline's duration (±1 frame).
const probe = JSON.parse(
  execFileSync(ffprobe.path, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,duration:format=duration,size', '-of', 'json', target], {encoding: 'utf8'}),
);
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const problems = [];
if (!v || v.codec_name !== 'h264') problems.push(`video stream ${v?.codec_name}`);
if (!a || a.codec_name !== 'aac') problems.push(`audio stream ${a?.codec_name}`);
if (v && (v.width !== timeline.width || v.height !== timeline.height)) problems.push(`size ${v.width}x${v.height}`);
if (v && Math.abs(Number(v.duration) - timeline.total) > 1 / timeline.fps + 1e-3) problems.push(`video ${v.duration} s, timeline ${timeline.total} s`);
if (a && Math.abs(Number(a.duration) - timeline.total) > 0.1) problems.push(`audio ${a.duration} s, timeline ${timeline.total} s`);
const size = Number(probe.format.size);
if (size >= 10 * 1024 * 1024) problems.push(`${size} bytes ≥ 10 MiB`);
log(`video ${v?.codec_name} ${v?.width}x${v?.height} ${v?.r_frame_rate} ${v?.duration} s · audio ${a?.codec_name} ${a?.duration} s · ${size} bytes`);
if (problems.length) {
  console.error(`[${secs()}s] FAILED probe: ${problems.join('; ')} (kept ${target})`);
  process.exit(1);
}
mkdirSync(path.dirname(out), {recursive: true});
copyFileSync(target, out);
log(`wrote ${out}`);
