import type { MCPToolResult } from "../types";
import { validateArgs, findChannelId } from "./tools";

let serverUrl = "http://localhost:3000";
let authToken = "";

export function setContext(url: string, token: string): void {
  serverUrl = url;
  authToken = token;
}

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${serverUrl}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json", ...opts.headers },
  });
}

function textResult(text: string): MCPToolResult {
  return { content: [{ type: "text", text }] };
}

async function postMessage(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel", "message"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  const res = await apiFetch(`/api/channels/${cid}/messages`, {
    method: "POST", body: JSON.stringify({ type: "text", content: args.message }),
  });
  if (!res.ok) throw new Error(`Failed to post: ${await res.text()}`);
  return textResult(`Message posted to ${args.channel}`);
}

async function readMessages(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  const limit = args.limit || 50, page = args.page || 0;
  const res = await apiFetch(`/api/channels/${cid}/messages?limit=${limit}&page=${page}`);
  if (!res.ok) throw new Error("Failed to read messages");
  const data = await res.json();
  return textResult(JSON.stringify(data.data?.items || [], null, 2));
}

async function askQuestion(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel", "question"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  const postRes = await apiFetch(`/api/channels/${cid}/messages`, {
    method: "POST", body: JSON.stringify({ type: "question", content: args.question }),
  });
  if (!postRes.ok) throw new Error("Failed to post question");
  const msgData = await postRes.json();
  const qId = msgData.data?.question_id;
  if (!qId) throw new Error("No question ID returned");
  const timeout = (args.timeout as number) || 60;
  const waitRes = await apiFetch(`/api/questions/${qId}/wait?timeout=${timeout * 1000}`);
  if (waitRes.ok) {
    const ans = await waitRes.json();
    if (ans.data) return textResult(JSON.stringify(ans.data));
  }
  return textResult("Question timed out");
}

async function searchMessages(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["pattern"]);
  const u = new URL(`${serverUrl}/api/search`);
  u.searchParams.set("q", args.pattern as string);
  if (args.channel) u.searchParams.set("channel", args.channel as string);
  const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${authToken}` } });
  if (!res.ok) throw new Error("Search failed");
  return textResult(JSON.stringify(await res.json(), null, 2));
}

async function listChannels(): Promise<MCPToolResult> {
  const res = await apiFetch("/api/channels");
  if (!res.ok) throw new Error("Failed to list channels");
  return textResult(JSON.stringify(await res.json(), null, 2));
}

async function joinChannel(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  const res = await apiFetch(`/api/channels/${cid}/join`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to join: ${res.statusText}`);
  return textResult(`Joined channel ${args.channel}`);
}

async function postStatus(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel", "status"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  const res = await apiFetch(`/api/channels/${cid}/messages`, {
    method: "POST", body: JSON.stringify({ type: "status", content: args.status }),
  });
  if (!res.ok) throw new Error(`Failed to post status: ${res.statusText}`);
  return textResult(`Status posted to ${args.channel}`);
}

async function createChannel(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["name"]);
  const res = await apiFetch("/api/channels", {
    method: "POST",
    body: JSON.stringify({ name: args.name, purpose: args.purpose || "" }),
  });
  if (!res.ok) throw new Error(`Failed to create channel: ${await res.text()}`);
  const data = await res.json();
  return textResult(JSON.stringify(data.data, null, 2));
}

async function getMessages(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  const limit = (args.limit as number) || 50;
  const res = await apiFetch(`/api/channels/${cid}/messages?limit=${limit}&page=0`);
  if (!res.ok) throw new Error("Failed to read messages");
  const data = await res.json();
  let messages: Record<string, unknown>[] = data.data?.items || [];

  // Time filtering
  if (args.since) {
    const sinceTime = typeof args.since === "number" ? args.since : new Date(args.since as string).getTime();
    if (!isNaN(sinceTime)) messages = messages.filter((m: Record<string, unknown>) => (m.created as number) >= sinceTime);
  }
  if (args.until) {
    const untilTime = typeof args.until === "number" ? args.until : new Date(args.until as string).getTime();
    if (!isNaN(untilTime)) messages = messages.filter((m: Record<string, unknown>) => (m.created as number) <= untilTime);
  }

  // Regex filtering
  if (args.regex) {
    try {
      const re = new RegExp(args.regex as string, "i");
      messages = messages.filter((m: Record<string, unknown>) => re.test(m.content as string));
    } catch { /* invalid regex, skip filter */ }
  }

  return textResult(JSON.stringify(messages, null, 2));
}

async function getHistory(args: Record<string, unknown>): Promise<MCPToolResult> {
  validateArgs(args, ["channel"]);
  const cid = await findChannelId(args.channel as string, serverUrl, authToken);
  if (!cid) throw new Error(`Channel not found: ${args.channel}`);
  let allMessages: Record<string, unknown>[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await apiFetch(`/api/channels/${cid}/messages?limit=100&page=${page}`);
    if (!res.ok) throw new Error("Failed to get history");
    const data = await res.json();
    const items: Record<string, unknown>[] = data.data?.items || [];
    hasMore = data.data?.hasMore || false;
    allMessages = allMessages.concat(items);
    page++;
  }
  return textResult(JSON.stringify(allMessages, null, 2));
}

const dispatch: Record<string, (args: Record<string, unknown>) => Promise<MCPToolResult>> = {
  create_channel: createChannel, post_message: postMessage, get_messages: getMessages,
  get_history: getHistory, read_messages: readMessages, ask_question: askQuestion,
  search_messages: searchMessages, list_channels: listChannels, join_channel: joinChannel,
  post_status: postStatus,
};

export async function executeTool(name: string, args: Record<string, unknown>, url: string, token: string): Promise<MCPToolResult> {
  setContext(url, token);
  const handler = dispatch[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args);
}
