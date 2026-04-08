import { describe, test, expect, beforeEach } from "bun:test";
import { resetDB, makeUser, makeChannel } from "./helpers";
import * as messageService from "../src/services/message";
import * as channelService from "../src/services/channel";

describe("Message Service", () => {
  beforeEach(resetDB);

  test("sends a text message", () => {
    const { user, channel } = makeChannel();
    const msg = messageService.send(channel.id, user.id, "text", "Hello world");
    expect(msg.content).toBe("Hello world");
    expect(msg.type).toBe("text");
    expect(msg.user_id).toBe(user.id);
  });

  test("sends a link message", () => {
    const { user, channel } = makeChannel();
    const msg = messageService.send(channel.id, user.id, "link", "https://example.com");
    expect(msg.type).toBe("link");
  });

  test("sends a status message", () => {
    const { user, channel } = makeChannel();
    const msg = messageService.send(channel.id, user.id, "status", "Build complete");
    expect(msg.type).toBe("status");
  });

  // E-03: Message to channel not joined
  test("rejects message from non-member", () => {
    const { channel } = makeChannel("alice");
    const { user: bob } = makeUser("bob");
    expect(() => messageService.send(channel.id, bob.id, "text", "hi")).toThrow("Not a member");
  });

  // E-13: Very long message
  test("rejects message over max length", () => {
    const { user, channel } = makeChannel();
    const longMsg = "x".repeat(10001);
    expect(() => messageService.send(channel.id, user.id, "text", longMsg)).toThrow("maximum length");
  });

  test("accepts message at max length", () => {
    const { user, channel } = makeChannel();
    const msg = messageService.send(channel.id, user.id, "text", "x".repeat(10000));
    expect(msg.content.length).toBe(10000);
  });

  test("lists messages with pagination", () => {
    const { user, channel } = makeChannel();
    for (let i = 0; i < 55; i++) {
      messageService.send(channel.id, user.id, "text", `msg ${i}`);
    }
    const page0 = messageService.list(channel.id, 0);
    expect(page0.items.length).toBe(50);
    expect(page0.hasMore).toBe(true);
    const page1 = messageService.list(channel.id, 1);
    expect(page1.items.length).toBe(5);
    expect(page1.hasMore).toBe(false);
  });

  test("pagination beyond range returns empty", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "hi");
    const result = messageService.list(channel.id, 5);
    expect(result.items.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  test("gets message by id", () => {
    const { user, channel } = makeChannel();
    const msg = messageService.send(channel.id, user.id, "text", "find me");
    const found = messageService.get(msg.id);
    expect(found?.content).toBe("find me");
  });

  // E-05: Message to channel with no other members (still works)
  test("sends message to channel with only sender", () => {
    const { user, channel } = makeChannel();
    const msg = messageService.send(channel.id, user.id, "text", "solo");
    expect(msg).toBeDefined();
  });
});
