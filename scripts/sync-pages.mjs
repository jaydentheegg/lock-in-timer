import {readFile,writeFile} from 'node:fs/promises';
import {focusMarkup} from '../lib/focus-markup.js';
const root = new URL('../',import.meta.url);
const css = (await readFile(new URL('app/globals.css',root),'utf8')).replaceAll("url('/fonts/","url('./fonts/");
const engine = await readFile(new URL('lib/focus-engine.js',root),'utf8');
await writeFile(new URL('github-pages/styles.css',root),css);
await writeFile(new URL('github-pages/app.js',root),engine+'\nconst dispose = mountFocus(document);\nwindow.addEventListener("pagehide",dispose,{once:true});\nwindow.addEventListener("pageshow",event=>{if(event.persisted)location.reload();});\n');
await writeFile(new URL('github-pages/index.html',root),`<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#000000"><title>专注计时器</title><link rel="icon" href="./favicon.svg"><link rel="stylesheet" href="./styles.css?v=12"></head><body>${focusMarkup}<script type="module" src="./app.js?v=12"></script></body></html>`);
console.log('GitHub Pages synchronized with the shared focus experience.');
