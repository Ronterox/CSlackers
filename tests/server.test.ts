import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { randomUUID } from "crypto";

const BASE = "http://localhost:3099";
const uid = () => randomUUID().slice(0, 8); // unique suffix for test names
let serverProcess: ReturnType<typeof Bun.spawn> | null = null;

describe("Server Integration", () => {
  beforeAll(async () => {
    serverProcess = Bun.spawn(["bun", "run", "src/server.ts"], {
      env: { ...process.env, PORT: "3099" },
      stdout: "pipe", stderr: "pipe",
    });
    await new Promise(r => setTimeout(r, 1000));
  });

  afterAll(() => { serverProcess?.kill(); });

  test("health endpoint returns ok", async () => {
    const data = await (await fetch(`${BASE}/api/health`)).json();
    expect(data.ok).toBe(true);
  });

  test("serves index.html at root", async () => {
    const res = await fetch(BASE);
    expect(res.ok).toBe(true);
    expect(await res.text()).toContain("CSlackers");
  });

  test("register, create channel, send message flow", async () => {
    const reg = await (await fetch(`${BASE}/api/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `test-${uid()}`, type: "human" }),
    })).json();
    expect(reg.ok).toBe(true);
    const token = reg.data.token;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const ch = await (await fetch(`${BASE}/api/channels`, {
      method: "POST", headers, body: JSON.stringify({ name: `ch-${uid()}` }),
    })).json();
    expect(ch.ok).toBe(true);

    const msg = await (await fetch(`${BASE}/api/channels/${ch.data.id}/messages`, {
      method: "POST", headers, body: JSON.stringify({ content: "hello" }),
    })).json();
    expect(msg.ok).toBe(true);
    expect(msg.data.content).toBe("hello");

    const list = await (await fetch(`${BASE}/api/channels/${ch.data.id}/messages`, { headers })).json();
    expect(list.data.items.length).toBe(1);
  });

  test("rejects unauthenticated requests", async () => {
    const res = await fetch(`${BASE}/api/channels`);
    expect(res.status).toBe(401);
  });

  test("messages persist across requests", async () => {
    const reg = await (await fetch(`${BASE}/api/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `persist-${uid()}` }),
    })).json();
    const headers = { Authorization: `Bearer ${reg.data.token}`, "Content-Type": "application/json" };

    const ch = await (await fetch(`${BASE}/api/channels`, {
      method: "POST", headers, body: JSON.stringify({ name: `pch-${uid()}` }),
    })).json();

    await fetch(`${BASE}/api/channels/${ch.data.id}/messages`, {
      method: "POST", headers, body: JSON.stringify({ content: "persistent" }),
    });

    const list = await (await fetch(`${BASE}/api/channels/${ch.data.id}/messages`, { headers })).json();
    expect(list.data.items.some(m => m.content === "persistent")).toBe(true);
  });
});
