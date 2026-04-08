import { stmts } from "../db.js";
import type { Message } from "../types.js";
import { MAX_MESSAGE_LENGTH, DEFAULT_PAGE_SIZE } from "../types.js";
import { isMember } from "./channel.js";

export function send(
  channelId: string,
  userId: string,
  type: string,
  content: string,
  replyTo?: string
): Message {
  if (!isMember(channelId, userId)) {
    throw new Error("Not a member of this channel");
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`);
  }

  const id = crypto.randomUUID();
  const created = Date.now();

  stmts().insertMessage.run(id, channelId, userId, type, content, replyTo || null, created);

  const msg = stmts().getMessage.get(id) as Message;
  return msg;
}

export function list(channelId: string, page: number, limit: number = DEFAULT_PAGE_SIZE): {
  items: Message[];
  hasMore: boolean;
} {
  const offset = page * limit;
  const items = stmts().getMessages.all(channelId, limit + 1, offset) as Message[];

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return { items, hasMore };
}

export function get(id: string): Message | null {
  const row = stmts().getMessage.get(id);
  return row ? (row as Message) : null;
}
