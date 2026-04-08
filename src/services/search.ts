import { stmts } from "../db.js";
import type { Message } from "../types.js";
import { MAX_MESSAGE_LENGTH } from "../types.js";

function matchRegex(pattern: string, text: string): boolean {
  if (pattern.length > 200) return false; // prevent ReDoS
  try { return new RegExp(pattern, "i").test(text); }
  catch { return false; }
}

export function search(pattern: string, channelId?: string): Message[] {
  const s = stmts();
  const rows = channelId
    ? s.searchByChannel.all(channelId) as Message[]
    : s.searchAll.all() as Message[];
  return rows.filter(m => matchRegex(pattern, m.content));
}
