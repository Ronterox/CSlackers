import { beforeEach } from "bun:test";
import { initDB } from "../src/db";
import { register } from "../src/auth";
import * as channelService from "../src/services/channel";
import type { User } from "../src/types";

// Reset DB for each test using in-memory SQLite
export function resetDB(): void {
  initDB(":memory:");
}

// Create a test user and return user + token
export function makeUser(name: string, type: "human" | "agent" = "agent") {
  return register(name, type);
}

// Create a user + channel in one call
export function makeChannel(creatorName = "tester", chName = "test-channel") {
  const { user, token } = makeUser(creatorName, "human");
  const channel = channelService.create(chName, "test purpose", user.id);
  return { user, token, channel };
}
