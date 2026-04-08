import { describe, test, expect, beforeEach } from "bun:test";
import { resetDB, makeUser } from "./helpers";
import * as auth from "../src/auth";

describe("Auth Service", () => {
  beforeEach(resetDB);

  test("registers a human user", () => {
    const { user, token } = auth.register("alice", "human");
    expect(user.name).toBe("alice");
    expect(user.type).toBe("human");
    expect(token).toContain(user.id);
  });

  test("registers an agent user", () => {
    const { user, token } = auth.register("agent-1", "agent");
    expect(user.type).toBe("agent");
  });

  test("validates a valid token", () => {
    const { user, token } = auth.register("alice");
    const validated = auth.validateToken(token);
    expect(validated?.id).toBe(user.id);
    expect(validated?.name).toBe("alice");
  });

  test("rejects invalid token", () => {
    expect(auth.validateToken("invalid:token")).toBeNull();
  });

  test("rejects empty token", () => {
    expect(auth.validateToken("")).toBeNull();
  });

  test("extracts token from Authorization header", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer abc123" },
    });
    expect(auth.extractToken(req)).toBe("abc123");
  });

  test("extracts token from query parameter", () => {
    const req = new Request("http://localhost?token=xyz789");
    expect(auth.extractToken(req)).toBe("xyz789");
  });

  test("returns null when no token present", () => {
    const req = new Request("http://localhost");
    expect(auth.extractToken(req)).toBeNull();
  });

  // Token tampering
  test("rejects tampered token", () => {
    const { user, token } = auth.register("alice");
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(auth.validateToken(tampered)).toBeNull();
  });

  test("authUser returns user for valid request", () => {
    const { user, token } = auth.register("alice");
    const req = new Request("http://localhost", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(auth.authUser(req)?.id).toBe(user.id);
  });

  test("authUser returns null for unauthenticated request", () => {
    const req = new Request("http://localhost");
    expect(auth.authUser(req)).toBeNull();
  });
});
