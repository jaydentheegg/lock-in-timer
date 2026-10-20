# Lock-In Timer

**Website:** [https://jaydentheegg.github.io/lock-in-timer/](https://jaydentheegg.github.io/lock-in-timer/)

拉下工牌进入，向下滑过四道阶段闸门，按下 LOCK-IN 开始。计时器在按下之前不存在。

快捷键：`空格` 开始 / 暂停、`R` 重置、`M` 静音、`F` 全屏。

加速预览：[10 / 25 / 45 / 75 秒切换阶段](https://jaydentheegg.github.io/lock-in-timer/?preview=events)。正式模式对应分钟；25 分钟后背景归黑，局部视频马赛克闪现。暂停仅冻结计时，背景音与环境效果继续。

## 专注屏蔽（NOISE FILTER）

按下 LOCK-IN 开始后，强制屏蔽社交媒体、视频和游戏：

- **网站**：浏览器扩展 `extension/` 拦截 `extension/blocklist.js` 里的社交、视频、游戏域名（含全部子域名），新打开的页面直接跳到拦截页，已经开着的标签页也会立刻被替换。QQ、百度只拦娱乐子域名，QQ 邮箱和百度搜索照常可用。
- **应用（macOS）**：本地助手每 2 秒检查一次，关掉微信、QQ、Discord、Telegram、Steam 及 Steam 游戏、Epic、战网、英雄联盟、Minecraft、Roblox 等，重新打开也会被再次关掉。
- **只能用重置解除**：暂停期间保持屏蔽；关掉计时页、刷新、重启浏览器都不会解除。唯一的出口是在计时器上按重置（`R`）。计时页已经关掉的话，重新打开后 HUD 显示 `NOISE FILTER / HELD`，重置按钮可用，按下即解除。
- HUD 右上角显示当前状态：`OFFLINE`（没装扩展，什么都不会被屏蔽）、`ARMED`（待命）、`ENGAGED`（屏蔽中）。

安装：

1. 在 Chrome / Edge / Brave / Arc 中打开 `chrome://extensions`，开启「开发者模式」，点「加载已解压的扩展程序」，选择仓库里的 `extension/` 文件夹。
2. 在扩展详情里打开「在无痕模式下启用」，否则无痕窗口不受限制。
3. 关闭应用（仅 macOS）：在仓库根目录运行下面的命令，然后重启浏览器。修改 `extension/native/` 或更换 Node 之后需要重新运行；加上 `--uninstall` 可以卸载。

```bash
node extension/native/install.mjs
```

修改屏蔽清单后，在扩展页点一下刷新即可生效。点工具栏上的扩展图标可以查看网站数量、应用助手是否已安装，以及无痕模式是否已允许。

局限：只覆盖装了扩展的 Chromium 系浏览器，Safari 和 Firefox 不受限制；在 `chrome://extensions` 里停用扩展会立即解除屏蔽，这是特意留下的紧急出口。

## 体验细节

- **开场**：低亮度白色星尘，拖动黑银工牌后进入探索。工牌印有 `Lock-In Timer`，有独立的正反面、薄卡体和金属扣件。
- **下潜**：滚动是自己写的（页面 `position:fixed`，没有真实文档滚动）：380vh 带动相机从 z 6.2 下潜到 -11.5，穿过四道刻着阶段阈值的环，抵达 LOCK-IN 开始面板。
- **两种模式，一条边界**：会话开始前可以往下钻；一旦开始，相机在 900ms 内收回顶部、世界淡出、滚轮被吞掉。暂停保留当前场景，重置才在 600ms 内返回探索。时钟挂在相机上，全程不动。
- **DEEP 转场**：25 分钟进入 DEEP 时，用 1.5 秒把白色星尘背景推进、像素化、向两侧展开，最后留下黑底与局部城市视频碎片。只采样背景层，不移动时间数字，不中断音乐，也不改累计时间。进入后显示一行 `DEEP / DEPTH CHANNEL ENGAGED`，红橙故障结束后清除。切到后台或重置会取消正在进行的转场，返回时不补播。
- **粒子时钟**：用离屏字形采样画成粒子，按字位分槽，没变的那一位不动。鼠标对背景星尘有轻微排斥。
- **减少动态效果**：系统开启「减少动态效果」时，不采样画面、不推进或碎裂，只淡出背景、淡入淡出字幕；背景星点静止，故障与扫描动画关闭。

## 项目结构

- `lib/focus-markup.js`（界面）、`lib/focus-engine.js`（计时与交互）、`app/globals.css`（样式）是唯一的界面来源，下面各个版本共用。
- `site/`：线上部署的 3D 版（Vite + three.js）。它只负责渲染，读取引擎写在 `data-*` 上的状态，不改界面。没有 WebGL2 时跳转到 `/fallback/`。
- `github-pages/`：CSS 版 fallback，由 `scripts/sync-pages.mjs` 在 `npm run build` 时生成，请勿直接修改。
- `app/`：React（vinext）版本，挂载同一套界面。
- `extension/`：专注屏蔽扩展；`extension/native/` 是 macOS 本地助手。
- 推送到 `main` 后，GitHub Actions 自动构建 `site/` 并部署到 GitHub Pages。

## 开发

需要 Node.js 22.13 或更高版本。

```bash
cd site && npm install && npm run dev   # 3D 版；媒体由 dev 中间件从仓库 public/ 提供
```

打开开发服务给出的地址，加上 `?preview=events` 进入加速预览（10 / 25 / 45 / 75 秒切换阶段，只影响阶段阈值，时间仍按真实秒数累计）。无 WebGL 版可以直接打开 `/fallback.html?preview=events`。

```bash
npm install
npm test       # 构建，并测试计时、阶段边界、转场生命周期、Pages 同步和屏蔽扩展
npm run lint
```

`cd site && npm run build` 验证线上实际使用的 3D 构建。自动化测试不等同于浏览器 / GPU 的视觉验收。
