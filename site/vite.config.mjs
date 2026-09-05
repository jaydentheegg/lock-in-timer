import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const REPO_PUBLIC = fileURLToPath(new URL("../public", import.meta.url));

const TYPES = {
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".vtt": "text/vtt",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

/**
 * The 71MB of media and the font files live in the repo's own public/ folder
 * and are copied straight into _site by CI. Serving them through a dev-only
 * middleware keeps them out of `vite build`, which would otherwise inline a
 * copy of all of it into dist.
 */
function repoMedia() {
  return {
    name: "repo-media",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = normalize(decodeURIComponent(request.url.split("?")[0]));
        if (path.includes("..")) return next();

        const file = join(REPO_PUBLIC, path);
        let stats;
        try {
          stats = statSync(file);
        } catch {
          return next();
        }
        if (!stats.isFile()) return next();

        const type = TYPES[extname(file)];
        if (type) response.setHeader("Content-Type", type);

        // Range support, so the browser can seek the video the way GitHub
        // Pages lets it.
        const range = request.headers.range;
        if (range) {
          const [start, end] = range.replace("bytes=", "").split("-");
          const from = Number.parseInt(start, 10) || 0;
          const to = end ? Number.parseInt(end, 10) : stats.size - 1;
          response.statusCode = 206;
          response.setHeader("Content-Range", `bytes ${from}-${to}/${stats.size}`);
          response.setHeader("Accept-Ranges", "bytes");
          response.setHeader("Content-Length", to - from + 1);
          return createReadStream(file, { start: from, end: to }).pipe(response);
        }

        response.setHeader("Content-Length", stats.size);
        return createReadStream(file).pipe(response);
      });
    },
  };
}

// Standalone from the repo root's vinext/Cloudflare app on purpose: three.js
// has no business in that dependency tree, and CI only installs this folder.
export default defineConfig({
  base: "./",
  // The root ships a Tailwind PostCSS config for the vinext app. Vite would
  // walk up and find it; this subproject wants neither.
  css: { postcss: {} },
  plugins: [repoMedia()],
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
