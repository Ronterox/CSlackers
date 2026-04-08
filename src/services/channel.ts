import { stmts } from "../db.js";
import type { Channel } from "../types.js";

export function create(name: string, purpose: string, creatorId: string): Channel {
  const id = crypto.randomUUID();
  const created = Date.now();

  stmts().insertChannel.run(id, name, purpose || "", created, creatorId);
  stmts().joinChannel.run(id, creatorId, created);

  const channel = stmts().getChannel.get(id) as Channel;
  return channel;
}

export function list(): Channel[] {
  return stmts().listChannels.all() as Channel[];
}

export function get(id: string): Channel | null {
  const row = stmts().getChannel.get(id);
  return row ? (row as Channel) : null;
}

export function join(channelId: string, userId: string): void {
  const existing = stmts().isMember.get(channelId, userId);
  if (existing) return;

  const joinedAt = Date.now();
  stmts().joinChannel.run(channelId, userId, joinedAt);
}

export function leave(channelId: string, userId: string): void {
  stmts().leaveChannel.run(channelId, userId);
}

export function del(channelId: string): void {
  stmts().deleteChannel.run(channelId);
}

export function isMember(channelId: string, userId: string): boolean {
  const row = stmts().isMember.get(channelId, userId);
  return !!row;
}
