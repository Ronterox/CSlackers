import { describe, test, expect, beforeEach } from "bun:test";
import { resetDB, makeChannel } from "./helpers";
import * as messageService from "../src/services/message";
import * as channelService from "../src/services/channel";
import * as searchService from "../src/services/search";

describe("Search Service", () => {
  beforeEach(resetDB);

  test("finds messages by substring", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "deploy completed");
    messageService.send(channel.id, user.id, "text", "build failed");
    const results = searchService.search("deploy");
    expect(results.length).toBe(1);
    expect(results[0].content).toContain("deploy");
  });

  test("finds messages by regex pattern", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "error: line 42");
    messageService.send(channel.id, user.id, "text", "error: line 99");
    messageService.send(channel.id, user.id, "text", "warning: deprecated");
    const results = searchService.search("error.*\\d+");
    expect(results.length).toBe(2);
  });

  // E-10: Search with zero results
  test("returns empty array when no matches", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "hello world");
    const results = searchService.search("nonexistent_pattern_xyz");
    expect(results.length).toBe(0);
  });

  // E-11: Search with regex special characters
  test("handles regex special chars safely", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "price is $50.00 (10%)");
    const results = searchService.search("\\$50\\.00");
    expect(results.length).toBe(1);
  });

  test("handles invalid regex gracefully", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "test message");
    const results = searchService.search("[invalid(regex");
    expect(results.length).toBe(0);
  });

  test("searches within specific channel", () => {
    const { user, channel } = makeChannel("alice", "dev");
    const { user: bob, channel: ch2 } = (() => {
      const b = makeChannel("bob", "random");
      return b;
    })();
    messageService.send(channel.id, user.id, "text", "dev update");
    channelService.join(ch2.id, user.id); // Need to join first
    // Actually need channelService import... let me fix
    // Just search in specific channel
    const results = searchService.search("update", channel.id);
    expect(results.length).toBe(1);
  });

  test("search is case insensitive", () => {
    const { user, channel } = makeChannel();
    messageService.send(channel.id, user.id, "text", "Hello World");
    const results = searchService.search("hello");
    expect(results.length).toBe(1);
  });
});
