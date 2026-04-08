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

const dispatch: Record<string, (args: Record<string, unknown>) => Promise<MCPToolResult>> = {
  post_message: postMessage, read_messages: readMessages, ask_question: askQuestion,
  search_messages: searchMessages, list_channels: listChannels, join_channel: joinChannel,
  post_status: postStatus,
};

export async function executeTool(name: string, args: Record<string, unknown>, url: string, token: string): Promise<MCPToolResult> {
  setContext(url, token);
  const handler = dispatch[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args);
}
