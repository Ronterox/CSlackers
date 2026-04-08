import { describe, test, expect, beforeEach } from "bun:test";
import { resetDB, makeUser, makeChannel } from "./helpers";
import * as channelService from "../src/services/channel";
import * as agentService from "../src/services/agent";

describe("Channel Service", () => {
  beforeEach(resetDB);

  test("creates a channel and auto-joins creator", () => {
    const { user, channel } = makeChannel("alice", "general");
    expect(channel.name).toBe("general");
    expect(channel.creator).toBe(user.id);
    expect(channelService.isMember(channel.id, user.id)).toBe(true);
  });

  test("lists all channels", () => {
    makeChannel("alice", "general");
    makeChannel("bob", "random");
    const channels = channelService.list();
    expect(channels.length).toBe(2);
  });

  test("gets channel by id", () => {
    const { channel } = makeChannel();
    const found = channelService.get(channel.id);
    expect(found?.name).toBe("test-channel");
  });

  test("returns null for nonexistent channel", () => {
    expect(channelService.get("nonexistent")).toBeNull();
  });

  // E-12: Channel name with special chars or empty
  test("creates channel with special characters in name", () => {
    const { user } = makeUser("alice");
    const ch = channelService.create("proj-#1_dev", "desc", user.id);
    expect(ch.name).toBe("proj-#1_dev");
  });

  test("rejects duplicate channel name", () => {
    makeChannel("alice", "general");
    const { user } = makeUser("bob");
    expect(() => channelService.create("general", "", user.id)).toThrow();
  });

  test("member joins and leaves channel", () => {
    const { channel } = makeChannel("alice");
    const { user: bob } = makeUser("bob");
    channelService.join(channel.id, bob.id);
    expect(channelService.isMember(channel.id, bob.id)).toBe(true);
    channelService.leave(channel.id, bob.id);
    expect(channelService.isMember(channel.id, bob.id)).toBe(false);
  });

  test("joining twice is idempotent", () => {
    const { channel } = makeChannel();
    const { user } = makeUser("bob");
    channelService.join(channel.id, user.id);
    channelService.join(channel.id, user.id);
    expect(channelService.isMember(channel.id, user.id)).toBe(true);
  });

  // E-02: Invalid channel ID
  test("join nonexistent channel throws", () => {
    const { user } = makeUser("bob");
    expect(() => channelService.join("nonexistent", user.id)).toThrow();
  });

  // E-16: Delete channel while members exist
  test("deletes channel even with members", () => {
    const { channel, user } = makeChannel();
    expect(channelService.isMember(channel.id, user.id)).toBe(true);
    channelService.del(channel.id);
    expect(channelService.get(channel.id)).toBeNull();
  });

  // E-05: Message to channel with no other members
  test("channel with single member is valid", () => {
    const { channel, user } = makeChannel();
    expect(channelService.isMember(channel.id, user.id)).toBe(true);
    const members = channelService.list();
    expect(members.length).toBe(1);
  });
});
