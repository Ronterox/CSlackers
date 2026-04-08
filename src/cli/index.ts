// CSlackers CLI - Server management and channel operations

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

const PID_FILE = "data/server.pid";
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "0.0.0.0";

function parseArgs(): { cmd: string; subcmd?: string; args: string[] } {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || "";
  const subcmd = argv[1];
  return { cmd, subcmd, args: argv.slice(2) };
}

function serverUrl(): string {
  const port = process.env.CSLACKERS_PORT || DEFAULT_PORT;
  return `http://localhost:${port}`;
}

async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const url = `${serverUrl()}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API error: ${res.statusText} ${url}`);
  return res.json();
}

async function cmdStart(port: number, host: string): Promise<void> {
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8"));
    try {
      process.kill(pid, 0); // Check if alive
      console.log(`Server already running (PID ${pid})`);
      return;
    } catch {
      // PID file stale, remove it
      unlinkSync(PID_FILE);
    }
  }

  // Ensure data directory exists
  mkdirSync("data", { recursive: true });

  const serverPath = join(import.meta.dir, "../server.ts");
  const proc = spawn("bun", ["run", serverPath], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, CSLACKERS_PORT: String(port), CSLACKERS_HOST: host }
  });

  writeFileSync(PID_FILE, String(proc.pid));
  proc.unref();

  console.log(`Server started on http://${host}:${port} (PID ${proc.pid})`);
}

function cmdStop(): void {
  if (!existsSync(PID_FILE)) {
    console.log("Server is not running");
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, "utf-8"));
  try {
    process.kill(pid, "SIGTERM");
    unlinkSync(PID_FILE);
    console.log(`Server stopped (PID ${pid})`);
  } catch (err) {
    console.error(`Failed to stop server: ${err}`);
    // Clean up stale PID file
    try { unlinkSync(PID_FILE); } catch {}
  }
}

async function cmdStatus(): Promise<void> {
  if (!existsSync(PID_FILE)) {
    console.log("Server: not running");
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, "utf-8"));
  try {
    process.kill(pid, 0); // Check if alive
    // Health check
    const health = await fetch(`${serverUrl()}/api/health`);
    if (health.ok) {
      console.log(`Server: running (PID ${pid})`);
    } else {
      console.log(`Server: process alive but unhealthy (PID ${pid})`);
    }
  } catch {
    console.log(`Server: not running (stale PID file)`);
    try { unlinkSync(PID_FILE); } catch {}
  }
}

async function cmdChannelList(): Promise<void> {
  const data = await apiFetch("/api/channels") as { ok: boolean; data?: unknown };
  if (!data.ok || !data.data) {
    console.log("No channels found");
    return;
  }
  console.log(JSON.stringify(data.data, null, 2));
}

async function cmdChannelCreate(name: string, purpose?: string): Promise<void> {
  if (!name) {
    console.log("Usage: channel create <name> [--purpose \"...\"]");
    return;
  }

  const data = await apiFetch("/api/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, purpose: purpose || "" })
  }) as { ok: boolean; data?: { id: string } };

  if (data.ok && data.data) {
    console.log(`Channel created: ${data.data.id}`);
  } else {
    console.log("Failed to create channel");
  }
}

async function main(): Promise<void> {
  const { cmd, subcmd, args } = parseArgs();

  switch (cmd) {
    case "start": {
      const port = parseInt(args.find(a => a.startsWith("--port="))?.split("=")[1] || String(DEFAULT_PORT));
      const host = args.find(a => a.startsWith("--host="))?.split("=")[1] || DEFAULT_HOST;
      await cmdStart(port, host);
      break;
    }
    case "stop":
      cmdStop();
      break;
    case "status":
      await cmdStatus();
      break;
    case "channel":
      if (subcmd === "list") {
        await cmdChannelList();
      } else if (subcmd === "create") {
        const name = args[0];
        const purposeIdx = args.indexOf("--purpose");
        const purpose = purposeIdx >= 0 ? args[purposeIdx + 1] : undefined;
        await cmdChannelCreate(name, purpose);
      } else {
        console.log("Usage: channel <list|create> [args]");
      }
      break;
    default:
      console.log(`
CSlackers CLI

Commands:
  start [--port=3000] [--host=0.0.0.0]   Start the server
  stop                                   Stop running server
  status                                 Check server status
  channel list                           List channels
  channel create <name> [--purpose "..."] Create channel

Environment:
  CSLACKERS_PORT                          Server port (default 3000)
  CSLACKERS_HOST                          Server host (default 0.0.0.0)
      `);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
