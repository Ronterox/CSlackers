import { register as registerAuth } from "../auth.js";
import { stmts } from "../db.js";
import type { User, UserType } from "../types.js";

export function register(name: string, type: UserType = "agent"): { user: User; token: string } {
  return registerAuth(name, type);
}

export function getIdentity(userId: string): User | null {
  const row = stmts().getUser.get(userId);
  return row ? (row as User) : null;
}
