// MCP (Model Context Protocol) JSON-RPC 2.0 Server
// Handles stdio communication with MCP clients (Claude, OpenCode, etc.)

import { initDB } from "../db";
import { register } from "../auth";
import { toolDefs } from "./tools";
import { executeTool } from "./execute";

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPServerCapabilities {
  tools: {};
}

let serverUrl = "http://localhost:3000";
let authToken = "";

function getAgentIdentity(): { name: string; serverUrl: string } {
  // Check env vars first, then use defaults
  const name = process.env.CSLACKERS_NAME || "mcp-agent";
  const url = process.env.CSLACKERS_SERVER || "http://localhost:3000";
  return { name, serverUrl: url };
}

function sendResponse(resp: JSONRPCResponse): void {
  process.stdout.write(JSON.stringify(resp) + "\n");
}

function sendError(id: number | string, code: number, message: string, data?: unknown): void {
  sendResponse({
    jsonrpc: "2.0",
    id,
    error: { code, message, data }
  });
}

function sendResult(id: number | string, result: unknown): void {
  sendResponse({
    jsonrpc: "2.0",
    id,
    result
  });
}

async function handleInitialize(req: JSONRPCRequest): Promise<void> {
  // Initialize database and register agent user
  initDB();
  const identity = getAgentIdentity();
  serverUrl = identity.serverUrl;

  const { user, token } = register(identity.name, "agent");
  authToken = token;

  // Return server capabilities
  sendResult(req.id, {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {} as MCPServerCapabilities
    },
    serverInfo: {
      name: "cslackers-mcp",
      version: "1.0.0"
    }
  });
}

function handleToolsList(req: JSONRPCRequest): void {
  sendResult(req.id, { tools: toolDefs });
}

async function handleToolsCall(req: JSONRPCRequest): Promise<void> {
  const params = req.params as { name: string; arguments: Record<string, unknown> } | undefined;
  if (!params) {
    sendError(req.id, -32602, "Invalid params: missing name and arguments");
    return;
  }

  try {
    const result = await executeTool(params.name, params.arguments, serverUrl, authToken);
    sendResult(req.id, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendError(req.id, -32603, "Tool execution failed", msg);
  }
}

function handleNotification(req: JSONRPCRequest): void {
  // Notifications don't need responses
  // "notifications/initialized" is just a client ping
}

async function handleMessage(line: string): Promise<void> {
  let req: JSONRPCRequest;
  try {
    req = JSON.parse(line) as JSONRPCRequest;
  } catch {
    sendError(0, -32700, "Parse error");
    return;
  }

  if (req.jsonrpc !== "2.0") {
    sendError(req.id || 0, -32600, "Invalid JSON-RPC version");
    return;
  }

  switch (req.method) {
    case "initialize":
      await handleInitialize(req);
      break;
    case "notifications/initialized":
      handleNotification(req);
      break;
    case "tools/list":
      handleToolsList(req);
      break;
    case "tools/call":
      await handleToolsCall(req);
      break;
    default:
      sendError(req.id || 0, -32601, "Method not found", req.method);
  }
}

export async function startMCPServer(): Promise<never> {
  const identity = getAgentIdentity();
  console.error(`[CSlackers MCP] Starting as agent "${identity.name}" connecting to ${identity.serverUrl}`);

  let buffer = "";
  for await (const chunk of process.stdin) {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        await handleMessage(line);
      }
    }
  }

  // Should never reach here
  process.exit(0);
}

// Allow running as standalone for testing
if (import.meta.main) {
  startMCPServer();
}
