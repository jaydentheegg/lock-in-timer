# Timer

**Website:** [https://jaydentheegg.github.io/wymcxvsure/](https://jaydentheegg.github.io/wymcxvsure/)

按下播放后开始的横屏专注正计时器，配有高清画面、默认开启的环境音和随机弹出的实时提醒。

快捷键：`空格` 开始 / 暂停、`R` 重置、`M` 静音、`F` 全屏。

加速预览：[10 / 25 / 45 / 75 秒切换阶段](https://jaydentheegg.github.io/wymcxvsure/?preview=events)。正式模式对应分钟；25 分钟后背景归黑，局部视频马赛克闪现。暂停仅冻结计时，背景音与环境效果继续。

界面来自 `lib/focus-markup.js`，交互来自 `lib/focus-engine.js`，样式来自 `app/globals.css`。React 和 GitHub Pages 共用这三份源文件。`npm run build` 会自动同步 `github-pages/`，请勿直接修改生成文件。画面只在短暂故障期间采样，减少动态效果的系统设置会关闭故障与扫描动画。

线上部署的是 `site/`——一个独立的 Vite 子工程，只负责渲染，不碰界面：标记、计时和所有 HUD 行为仍然来自上面那三份源文件，渲染层只读引擎写在 `data-*` 上的状态。没有 WebGL2 时跳转到 `/fallback/`，那是完整的 CSS 版。

```bash
cd site && npm install && npm run dev   # 媒体由 dev 中间件从仓库 public/ 提供
```

- 画面、遮罩、暗角合并成一个着色器；时钟用离屏字形采样画成粒子，按字位分槽，没变的那一位不动；指针涟漪扰动的是正在播放的画面。
- 滚动是自己写的（页面 `position:fixed`，没有真实文档滚动给 Lenis 平滑）：380vh 带动相机从 z 6.2 下潜到 -11.5，穿过四道刻着阶段阈值的环，抵达开始面板。
- **两种模式，一条边界。** 计时停止时可以往下钻；一旦开始，相机在 900ms 内收回顶部、世界淡出、滚轮被吞掉。暂停则在 600ms 内还回来。时钟挂在相机上，全程不动。

---

## Development

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build, verify timing/phase boundaries, and check React/Pages parity
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
