import type { MCPTool } from "../types";

export const toolDefs: MCPTool[] = [
  {
    name: "post_message", description: "Send a text message to a channel",
    inputSchema: { type: "object", properties: { channel: { type: "string", description: "Channel name" }, message: { type: "string", description: "Message content" } }, required: ["channel", "message"] }
  },
  {
    name: "read_messages", description: "Read recent messages from a channel",
    inputSchema: { type: "object", properties: { channel: { type: "string", description: "Channel name" }, limit: { type: "number", description: "Max messages (default 50)" }, page: { type: "number", description: "Page number (default 0)" } }, required: ["channel"] }
  },
  {
    name: "ask_question", description: "Ask a question and wait for human response",
    inputSchema: { type: "object", properties: { channel: { type: "string", description: "Channel name" }, question: { type: "string", description: "Question to ask" }, timeout: { type: "number", description: "Timeout in seconds (default 60)" } }, required: ["channel", "question"] }
  },
  {
    name: "search_messages", description: "Search messages by regex pattern",
    inputSchema: { type: "object", properties: { pattern: { type: "string", description: "Regex pattern" }, channel: { type: "string", description: "Optional channel name" } }, required: ["pattern"] }
  },
  {
    name: "list_channels", description: "List all available channels",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "join_channel", description: "Join a channel by name",
    inputSchema: { type: "object", properties: { channel: { type: "string", description: "Channel name" } }, required: ["channel"] }
  },
  {
    name: "post_status", description: "Post a status update message",
    inputSchema: { type: "object", properties: { channel: { type: "string", description: "Channel name" }, status: { type: "string", description: "Status message" } }, required: ["channel", "status"] }
  },
];

export function validateArgs(args: Record<string, unknown>, required: string[]): void {
  for (const key of required) {
    if (args[key] === undefined || args[key] === null) {
      throw new Error(`Missing required argument: ${key}`);
    }
  }
}

export async function findChannelId(name: string, url: string, token: string): Promise<string | null> {
  const res = await fetch(`${url}/api/channels`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.ok || !data.data) return null;
  const ch = data.data.find((c: { name: string }) => c.name === name);
  return ch?.id || null;
}
