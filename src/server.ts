import { join, resolve, relative } from "path";
import { authUser } from "./auth.js";
import { initDB } from "./db.js";
import type { WSEvent, WSData } from "./types.js";
import * as channelService from "./services/channel.js";
import * as messageService from "./services/message.js";
import * as agentService from "./services/agent.js";
import * as searchService from "./services/search.js";
import * as questionService from "./services/question.js";
import * as imageService from "./services/image.js";

const PORT = parseInt(process.env.PORT || "3000");
const UPLOAD_DIR = resolve("data/uploads");
const PUBLIC_DIR = resolve("public");
const clients = new Map<WebSocket, WSData>();

function cors(): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" };
}
function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(), "Content-Type": "application/json" } });
}
function safePath(base: string, userPath: string): string | null {
  const resolved = resolve(base, userPath);
  return resolved.startsWith(base + "/") ? resolved : null;
}
function broadcast(event: WSEvent, exclude?: WebSocket): void {
  const data = JSON.stringify(event);
  for (const [ws] of clients) { if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(data); }
}

async function handleRequest(req: Request): Promise<Response> {
  try {
    return await _handleRequest(req);
  } catch (err) {
    if (err instanceof SyntaxError) return json({ ok: false, error: "Invalid JSON body" }, 400);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
}

async function _handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });

  // Static files (path traversal safe)
  if (path.startsWith("/uploads/")) {
    const safe = safePath(UPLOAD_DIR, path.slice("/uploads/".length));
    if (!safe) return json({ ok: false, error: "Forbidden" }, 403);
    return new Response(Bun.file(safe));
  }
  if (path === "/" || path.match(/\.(js|css|html|json|png|ico|svg)$/)) {
    const filePath = path === "/" ? "index.html" : path.replace(/^\//, "");
    const safe = safePath(PUBLIC_DIR, filePath);
    if (!safe) return json({ ok: false, error: "Forbidden" }, 403);
    return new Response(Bun.file(safe));
  }

  if (path === "/api/health") return json({ ok: true, timestamp: Date.now() });

  // Register (no auth, validate input)
  if (path === "/api/register" && req.method === "POST") {
    const body = await req.json();
    const name = String(body.name || "").slice(0, 50);
    if (!name) return json({ ok: false, error: "Name required" }, 400);
    const result = agentService.register(name, body.type);
    return json({ ok: true, data: result });
  }

  const user = authUser(req);
  if (!user) return json({ ok: false, error: "Unauthorized" }, 401);

  // Channels
  if (path === "/api/channels" && req.method === "GET")
    return json({ ok: true, data: channelService.list() });
  if (path === "/api/channels" && req.method === "POST") {
    const body = await req.json();
    return json({ ok: true, data: channelService.create(body.name, body.purpose, user.id) });
  }

  const chMatch = path.match(/^\/api\/channels\/([^/]+)(\/.*)?$/);
  if (chMatch) {
    const [_, cid, sub] = chMatch;
    if (sub === "/join" && req.method === "POST") { channelService.join(cid, user.id); return json({ ok: true }); }
    if (sub === "/leave" && req.method === "POST") { channelService.leave(cid, user.id); return json({ ok: true }); }
    if (!sub && req.method === "DELETE") {
      const ch = channelService.get(cid);
      if (!ch) return json({ ok: false, error: "Not found" }, 404);
      channelService.del(cid);
      return json({ ok: true });
    }
    if (sub === "/messages" && req.method === "GET")
      return json({ ok: true, data: messageService.list(cid, parseInt(url.searchParams.get("page") || "0")) });
    if (sub === "/messages" && req.method === "POST") {
      const body = await req.json();
      // Branch: question type uses questionService.ask()
      if (body.type === "question") {
        const result = questionService.ask(cid, user.id, body.content);
        return json({ ok: true, data: { ...result.message, question_id: result.question.id } });
      }
      return json({ ok: true, data: messageService.send(cid, user.id, body.type || "text", body.content, body.replyTo) });
    }
    if (sub === "/images" && req.method === "POST") {
      const fd = await req.formData();
      const file = fd.get("image");
      if (!file || !(file instanceof File)) return json({ ok: false, error: "No image provided" }, 400);
      return json({ ok: true, data: await imageService.upload(file, cid, user.id) });
    }
  }

  // Search
  if (path === "/api/search" && req.method === "GET")
    return json({ ok: true, data: searchService.search(url.searchParams.get("q") || "", url.searchParams.get("channel") || undefined) });

  // Questions
  if (path === "/api/questions" && req.method === "GET")
    return json({ ok: true, data: questionService.listOpen() });

  const qMatch = path.match(/^\/api\/questions\/([^/]+)(\/.*)?$/);
  if (qMatch) {
    const [_, qid, sub] = qMatch;
    if (sub === "/answer" && req.method === "POST") {
      const body = await req.json();
      return json({ ok: true, data: questionService.answer(qid, user.id, body.content) });
    }
    if (sub === "/wait" && req.method === "GET") {
      const timeout = parseInt(url.searchParams.get("timeout") || "30000");
      try { return json({ ok: true, data: await questionService.wait(qid, timeout) }); }
      catch (err) { return json({ ok: false, error: (err as Error).message }, 408); }
    }
  }
  return json({ ok: false, error: "Not found" }, 404);
}

initDB();
const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    if (req.headers.get("upgrade") === "websocket") {
      const user = authUser(req);
      if (!user) return new Response("Unauthorized", { status: 401 });
      const ok = server.upgrade(req, { data: { userId: user.id, userName: user.name, userType: user.type } as WSData });
      if (ok) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return handleRequest(req);
  },
  websocket: {
    open(ws) { const d = ws.data as WSData; clients.set(ws, d); broadcast({ type: "user:joined", payload: { id: d.userId, name: d.userName } }); },
    message(ws, message) {
      try {
        const d = ws.data as WSData;
        const event = JSON.parse(message.toString()) as WSEvent;
        if (event.payload && typeof event.payload === "object") event.payload = { ...event.payload, userId: d.userId, userName: d.userName };
        broadcast(event, ws);
      } catch { /* ignore malformed WS messages */ }
    },
    close(ws) { const d = ws.data as WSData; clients.delete(ws); broadcast({ type: "user:left", payload: { id: d.userId, name: d.userName } }); },
  },
});
console.log(`CSlackers server listening on http://0.0.0.0:${PORT}`);
