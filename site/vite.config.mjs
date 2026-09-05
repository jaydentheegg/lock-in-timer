import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { focusMarkup } from "../lib/focus-markup.js";

const REPO_PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const GLOBALS_CSS = fileURLToPath(new URL("../app/globals.css", import.meta.url));

const TYPES = {
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".vtt": "text/vtt",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

/** The one interface shared with the React view and the Pages fallback. */
function sharedMarkup() {
  return {
    name: "shared-markup",
    transformIndexHtml(html) {
      return html.replace("<!--focus-markup-->", focusMarkup);
    },
  };
}

/**
 * globals.css addresses fonts from the site root because the React app serves
 * it from /. Here it is bundled into /assets/, and GitHub Pages serves the
 * site from /wymcxvsure/, so the same absolute path would 404.
 */
function relativeFontUrls() {
  return {
    name: "relative-font-urls",
    transform(code, id) {
      if (id.split("?")[0] !== GLOBALS_CSS) return null;
      return { code: code.replaceAll("url('/fonts/", "url('../fonts/"), map: null };
    },
  };
}

/**
 * The media and the fonts live in the repo's public/ folder and are copied
 * straight into _site by CI. Serving them through a dev-only middleware keeps
 * them out of `vite build`, which would otherwise duplicate all of it in dist.
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

        // Range support, so the browser can seek media the way Pages allows.
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

// Standalone from the repo root's vinext app on purpose: three.js has no
// business in that dependency tree, and CI installs only this folder.
export default defineConfig({
  base: "./",
  // The root ships a Tailwind PostCSS config for the vinext app; this
  // subproject wants neither it nor the walk up the tree to find it.
  css: { postcss: {} },
  plugins: [sharedMarkup(), relativeFontUrls(), repoMedia()],
  build: { target: "es2022", outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
});
