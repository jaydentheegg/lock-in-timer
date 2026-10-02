import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {APP_RULES,BLOCKED_DOMAINS,NATIVE_HOST,isBlockedUrl} from '../extension/blocklist.js';
import {createDecoder,encode,findTargets,parsePs} from '../extension/native/guard.mjs';
import {extensionId} from '../extension/native/install.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const mac=process.platform==='darwin';

test('the blocklist is a clean set of hostnames that also covers subdomains',()=>{
  assert.equal(new Set(BLOCKED_DOMAINS).size,BLOCKED_DOMAINS.length);
  for(const domain of BLOCKED_DOMAINS)assert.match(domain,/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  for(const url of ['https://www.youtube.com/watch?v=1','https://m.bilibili.com/','http://WEIBO.com.','https://store.steampowered.com/app/1','https://v.qq.com/x','https://www.xiaohongshu.com/explore','https://x.com/home'])
    assert.equal(isBlockedUrl(url),true,url);
  // Look-alikes, and the useful parts of mixed domains, stay reachable.
  for(const url of ['https://notyoutube.com/','https://mail.qq.com/','https://www.baidu.com/s?wd=1','https://github.com/','chrome-extension://abc/x','not a url'])
    assert.equal(isBlockedUrl(url),false,url);
});

test('the extension manifest wires the timer, the block page and a fixed ID',async()=>{
  const manifest=JSON.parse(await read('extension/manifest.json'));
  assert.equal(manifest.manifest_version,3);
  assert.ok(manifest.content_scripts[0].matches.includes('https://jaydentheegg.github.io/lock-in-timer/*'));
  assert.ok(manifest.web_accessible_resources[0].resources.includes('blocked.html'));
  for(const file of [manifest.background.service_worker,...manifest.content_scripts[0].js,'blocked.html','blocked.js','popup.html','popup.js','ui.css'])
    await stat(new URL('../extension/'+file,import.meta.url));
  // install.mjs grants the native host to exactly this ID.
  assert.equal(extensionId(manifest.key),'gkejpilphamlmhcdliammmlcpnbfkmlp');
});

test('native messages survive arbitrary chunking',()=>{
  const seen=[];const feed=createDecoder(message=>seen.push(message));
  const bytes=Buffer.concat([encode({type:'lock',rules:[{label:'微信'}]}),encode({type:'unlock'})]);
  for(let i=0;i<bytes.length;i+=3)feed(bytes.subarray(i,i+3));
  assert.deepEqual(seen,[{type:'lock',rules:[{label:'微信'}]},{type:'unlock'}]);
});

test('app rules catch bundles, nested helpers and Java games, and nothing else',()=>{
  const exes=parsePs(`  10 /Applications/Steam.app/Contents/MacOS/steam_osx
  11 /Users/me/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/ipcserver
  12 /Users/me/Library/Application Support/Steam/steamapps/common/Hades/Hades.app/Contents/MacOS/Hades
  13 /Applications/WeChat.app/Contents/MacOS/WeChat
  14 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  15 /usr/bin/java
  16 /Applications/Discord.app/Contents/Frameworks/Discord Helper (Renderer).app/Contents/MacOS/Discord Helper (Renderer)
  17 /Applications/QQ.app/Contents/MacOS/QQ
  18 /Applications/Visual Studio Code.app/Contents/MacOS/Electron
  19 /System/Applications/Chess.app/Contents/MacOS/Chess`);
  const commands=parsePs(`15 /usr/bin/java -cp client.jar net.minecraft.client.main.Main
  18 /Applications/Visual Studio Code.app/Contents/MacOS/Electron /Applications/QQ.app/notes.md`);
  const hits=findTargets(APP_RULES,exes,commands,new Set([17]));
  assert.deepEqual(hits,[{pid:10,label:'Steam'},{pid:12,label:'Steam game'},{pid:13,label:'WeChat'},{pid:15,label:'Minecraft'},{pid:16,label:'Discord'},{pid:19,label:'Chess'}]);
});

test('the installer registers the host for the extension and pins Node',{skip:!mac},async t=>{
  const home=await mkdtemp(join(tmpdir(),'noise-filter-'));t.after(()=>rm(home,{recursive:true,force:true}));
  const profile=join(home,'profile');await mkdir(profile);
  const run=args=>new Promise((resolve,reject)=>spawn(process.execPath,[new URL('../extension/native/install.mjs',import.meta.url).pathname,...args],{env:{...process.env,HOME:home}})
    .on('exit',code=>code===0?resolve():reject(new Error('install exited '+code))));
  await run(['--browser-dir',profile]);
  const manifest=JSON.parse(await readFile(join(profile,'NativeMessagingHosts',NATIVE_HOST+'.json'),'utf8'));
  assert.deepEqual(manifest.allowed_origins,['chrome-extension://gkejpilphamlmhcdliammmlcpnbfkmlp/']);
  assert.ok(manifest.path.startsWith(join(home,'Library/Application Support/LockInNoiseFilter')));
  assert.ok((await stat(manifest.path)).mode&0o100);
  assert.ok((await readFile(manifest.path,'utf8')).includes(process.execPath));
  await run(['--uninstall','--browser-dir',profile]);
  await assert.rejects(stat(join(profile,'NativeMessagingHosts',NATIVE_HOST+'.json')));
});

test('the host closes a matching app while locked and exits on unlock',{skip:!mac},async t=>{
  // A copied system binary is killed by code signing, so the stand-in game is
  // a Node process carrying a unique marker on its command line.
  const marker=`lockin-fake-game-${process.pid}-${Date.now()}`;
  const game=spawn(process.execPath,['-e','setTimeout(()=>{},6e5)',marker]);
  const gameExit=new Promise(resolve=>game.on('exit',(code,signal)=>resolve(signal)));
  const host=spawn(process.execPath,[new URL('../extension/native/host.mjs',import.meta.url).pathname]);
  t.after(()=>{game.kill('SIGKILL');host.kill('SIGKILL');});
  const messages=[];let wake=()=>{};
  host.stdout.on('data',createDecoder(message=>{messages.push(message);wake();}));
  const next=async type=>{while(!messages.some(m=>m.type===type))await new Promise(resolve=>{wake=resolve;});return messages.find(m=>m.type===type);};
  host.stdin.write(encode({type:'ping'}));
  await next('pong');
  host.stdin.write(encode({type:'lock',rules:[{label:'Fake Game',args:[marker.toUpperCase()]}]}));
  assert.equal((await next('ready')).rules,1);
  assert.equal((await next('closed')).label,'Fake Game');
  assert.equal(await gameExit,'SIGTERM');
  const hostExit=new Promise(resolve=>host.on('exit',resolve));
  host.stdin.write(encode({type:'unlock'}));
  assert.equal(await hostExit,0);
});

test('the HUD shows the filter in English and the extension speaks to it',async()=>{
  const [markup,content]=await Promise.all([read('lib/focus-markup.js'),read('extension/content.js')]);
  assert.ok(markup.includes('class="filter-label">NOISE FILTER / OFFLINE<'));
  assert.ok(content.includes('root.dataset.noiseFilter'));
  assert.ok(content.includes('"focusreset"'));
});
