// CSlackers Type Definitions

export type UserType = "human" | "agent";
export type MsgType = "text" | "image" | "link" | "question" | "status";
export type QStatus = "open" | "answered" | "expired";

export interface User {
  id: string;
  name: string;
  type: UserType;
  created: number;
}

export interface Channel {
  id: string;
  name: string;
  purpose: string;
  created: number;
  creator: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  user_name?: string;
  type: MsgType;
  content: string;
  reply_to?: string;
  created: number;
}

export interface Question {
  id: string;
  message_id: string;
  asked_by: string;
  answered_by?: string;
  answer_msg?: string;
  status: QStatus;
  created: number;
  resolved?: number;
}

// WebSocket event envelope
export interface WSEvent {
  type: string;
  payload: unknown;
}

// WebSocket data attached to connection
export interface WSData {
  userId: string;
  userName: string;
  userType: UserType;
}

// REST API response wrappers
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

// MCP tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
}

// Constants
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const DEFAULT_PAGE_SIZE = 50;
