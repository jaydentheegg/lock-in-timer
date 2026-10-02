// Native messaging host for the noise filter. Chrome starts it when a session
// engages the filter and keeps it running until the session is reset or the
// browser quits. While locked it closes every process the rules name, every
// two seconds, so relaunching a game only buys it a moment.
//
// stdout is the protocol channel: never log to it.
import { createDecoder, encode, findTargets, listProcesses } from "./guard.mjs";

const SWEEP_MS = 2000, GRACE_MS = 3000;
let rules = [], timer = null, sweeping = false;
const signalled = new Map();

const send = message => process.stdout.write(encode(message));

async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    const [exes, commands] = await Promise.all([listProcesses("pid=,comm="), listProcesses("pid=,args=")]);
    const alive = new Set(exes.map(({ pid }) => pid));
    for (const pid of signalled.keys()) if (!alive.has(pid)) signalled.delete(pid);

    const now = Date.now(), closed = new Set();
    for (const { pid, label } of findTargets(rules, exes, commands, new Set([process.pid, process.ppid]))) {
      const since = signalled.get(pid);
      try {
        if (since === undefined) {
          process.kill(pid, "SIGTERM");
          signalled.set(pid, now);
          closed.add(label);
        } else if (now - since > GRACE_MS) {
          // Asked politely and still running.
          process.kill(pid, "SIGKILL");
        }
      } catch {
        // Already gone, or not ours to signal.
      }
    }
    for (const label of closed) send({ type: "closed", label });
  } catch (error) {
    process.stderr.write(`noise filter sweep failed: ${error}\n`);
  } finally {
    sweeping = false;
  }
}

function handle(message) {
  if (message.type === "ping") send({ type: "pong" });
  else if (message.type === "lock") {
    rules = Array.isArray(message.rules) ? message.rules : [];
    if (!timer) timer = setInterval(sweep, SWEEP_MS);
    send({ type: "ready", rules: rules.length });
    void sweep();
  } else if (message.type === "unlock") process.exit(0);
}

process.stdin.on("data", createDecoder(handle));
process.stdin.on("end", () => process.exit(0));
