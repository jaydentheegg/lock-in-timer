// The pieces of the app filter that do not talk to Chrome: native messaging
// framing, the process table, and which processes the rules catch.
import { execFile } from "node:child_process";

// Chrome frames every message as a native-endian uint32 length and UTF-8 JSON.
export function encode(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}

export function createDecoder(onMessage) {
  let pending = Buffer.alloc(0);
  return chunk => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 4) {
      const length = pending.readUInt32LE(0);
      if (pending.length < 4 + length) break;
      const body = pending.subarray(4, 4 + length);
      pending = pending.subarray(4 + length);
      onMessage(JSON.parse(body.toString("utf8")));
    }
  };
}

// Paths may arrive decomposed (NFD) from the file system and composed from the
// rules; compare both the same way.
const fold = text => text.normalize("NFC").toLowerCase();

export function parsePs(output) {
  return output.split("\n").flatMap(line => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    return match ? [{ pid: Number(match[1]), text: match[2] }] : [];
  });
}

/** `exes` and `commands` are parsed `ps` listings of executable paths and full command lines. */
export function findTargets(rules, exes, commands, protect = new Set()) {
  const lines = new Map(commands.map(({ pid, text }) => [pid, fold(text)]));
  const folded = rules.map(rule => ({
    label: rule.label,
    exe: (rule.exe ?? []).map(fold),
    args: (rule.args ?? []).map(fold),
  }));
  const hits = [];
  for (const { pid, text } of exes) {
    if (protect.has(pid)) continue;
    const exe = fold(text), line = lines.get(pid) ?? "";
    const rule = folded.find(r => r.exe.some(part => exe.includes(part)) || r.args.some(part => line.includes(part)));
    if (rule) hits.push({ pid, label: rule.label });
  }
  return hits;
}

/** The current user's processes; other users' are out of reach anyway. */
export function listProcesses(columns) {
  return new Promise((resolve, reject) => {
    execFile(
      "/bin/ps", ["-x", "-U", String(process.getuid()), "-ww", "-o", columns],
      { env: { ...process.env, LC_ALL: "en_US.UTF-8" }, maxBuffer: 32 << 20 },
      (error, stdout) => (error ? reject(error) : resolve(parsePs(stdout))),
    );
  });
}
