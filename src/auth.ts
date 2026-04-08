import { randomBytes } from "crypto";
import { stmts } from "./db";
import type { User, UserType } from "./types";

export function register(name: string, type: UserType = "agent"): { user: User; token: string } {
  const id = crypto.randomUUID();
  const created = Date.now();
  const token = `${id}:${randomBytes(16).toString("hex")}`;

  stmts().insertUser.run(id, name, type, created);
  stmts().insertToken.run(token, id, created);

  return { user: { id, name, type, created }, token };
}

export function validateToken(token: string): User | null {
  const row = stmts().getToken.get(token) as { user_id: string } | null;
  if (!row) return null;

  const user = stmts().getUser.get(row.user_id) as User | null;
  return user;
}

export function extractToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const url = new URL(req.url);
  return url.searchParams.get("token");
}

export function authUser(req: Request): User | null {
  const token = extractToken(req);
  if (!token) return null;
  return validateToken(token);
}
