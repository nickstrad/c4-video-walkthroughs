import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
const duration=p=>Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',p],{encoding:'utf8'}).trim());
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','public/browser.webm','-an','-c:v','libx264','-threads','2','-crf','25','-pix_fmt','yuv420p','public/browser.mp4']);
const s=JSON.parse(readFileSync('storyboard.json'));s.browserPlaybackRate=duration('public/browser.mp4')/12;writeFileSync('storyboard.json',JSON.stringify(s,null,2)+'\n');
renameSync('public/terminal.mp4','public/terminal-vhs.mp4');
const d=duration('public/terminal-vhs.mp4');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','public/terminal-vhs.mp4','-vf',`setpts=${9/d}*PTS,fps=30,tpad=stop_mode=clone:stop_duration=1`,'-t','9','-an','-c:v','libx264','-threads','2','-crf','22','-pix_fmt','yuv420p','public/terminal.mp4']);
writeFileSync('evidence/normalization.json',JSON.stringify({browserRawSeconds:duration('public/browser.webm'),browserPlaybackRate:s.browserPlaybackRate,terminalVhsRawSeconds:d,terminalComposedSeconds:9,terminalTreatment:'Retimed actual VHS output to fill nine-second scene; no synthetic test output.'},null,2)+'\n');
