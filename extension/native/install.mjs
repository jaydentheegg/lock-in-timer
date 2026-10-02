// Registers the app filter with every Chromium browser on this Mac.
//
//   node extension/native/install.mjs              install or update
//   node extension/native/install.mjs --uninstall  remove it again
//   node extension/native/install.mjs --browser-dir <user data dir>
//                                                  only that browser profile root
//
// The host is copied to ~/Library/Application Support/LockInNoiseFilter rather
// than run from the repository: a browser starting a script inside Documents
// or Desktop would trip macOS privacy prompts. Re-run after pulling changes to
// native/, or after moving or upgrading Node.
import { realpathSync } from "node:fs";
import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NATIVE_HOST } from "../blocklist.js";

const BROWSERS = {
  "Google Chrome": "Google/Chrome",
  "Chrome Beta": "Google/Chrome Beta",
  "Chrome Canary": "Google/Chrome Canary",
  Chromium: "Chromium",
  "Microsoft Edge": "Microsoft Edge",
  Brave: "BraveSoftware/Brave-Browser",
  Arc: "Arc/User Data",
  Vivaldi: "Vivaldi",
};

/** Chrome's ID for an extension whose manifest carries this public key. */
export function extensionId(key) {
  const hex = createHash("sha256").update(Buffer.from(key, "base64")).digest("hex").slice(0, 32);
  return [...hex].map(digit => String.fromCharCode(97 + Number.parseInt(digit, 16))).join("");
}

const exists = path => stat(path).then(() => true, () => false);
const quote = value => `'${value.replaceAll("'", `'\\''`)}'`;

async function main(argv) {
  if (process.platform !== "darwin") throw new Error("The app filter is macOS only; the extension still blocks sites everywhere.");
  const uninstall = argv.includes("--uninstall");
  const dirFlag = argv.indexOf("--browser-dir");
  const support = join(homedir(), "Library/Application Support");
  const home = join(support, "LockInNoiseFilter");

  const roots = dirFlag >= 0
    ? [["Browser", argv[dirFlag + 1]]]
    : Object.entries(BROWSERS).map(([name, dir]) => [name, join(support, dir)]);
  const targets = [];
  for (const [name, root] of roots) if (root && await exists(root)) targets.push([name, join(root, "NativeMessagingHosts")]);

  if (uninstall) {
    for (const [, dir] of targets) await rm(join(dir, `${NATIVE_HOST}.json`), { force: true });
    if (dirFlag < 0) await rm(home, { recursive: true, force: true });
    console.log("Noise filter host removed.");
    return;
  }
  if (!targets.length) throw new Error("No Chromium browser profile found.");

  await mkdir(home, { recursive: true });
  for (const file of ["host.mjs", "guard.mjs"]) await copyFile(new URL(file, import.meta.url), join(home, file));
  const launcher = join(home, "lockin-filter-host");
  // Browsers start hosts with a bare PATH, so pin the Node that ran this.
  await writeFile(launcher, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(join(home, "host.mjs"))}\n`);
  await chmod(launcher, 0o755);

  const { key } = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const manifest = {
    name: NATIVE_HOST,
    description: "Lock-In Noise Filter: closes game and social apps during a focus session",
    path: launcher,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId(key)}/`],
  };
  for (const [name, dir] of targets) {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${NATIVE_HOST}.json`), JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Registered with ${name}.`);
  }
  console.log(`Host installed in ${home} (Node ${process.version}).`);
}

// Run as a script, not when imported; resolve links such as /var -> /private/var.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
