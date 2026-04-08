import { describe, test, expect, beforeEach } from "bun:test";
import { resetDB, makeChannel } from "./helpers";
import { MAX_IMAGE_SIZE } from "../src/types";

describe("Image Service", () => {
  beforeEach(resetDB);

  test("rejects image exceeding max size", async () => {
    const { user, channel } = makeChannel();
    const bigFile = new File(["x".repeat(MAX_IMAGE_SIZE + 1)], "big.png", { type: "image/png" });
    const { upload } = await import("../src/services/image");
    await expect(upload(bigFile, channel.id, user.id)).rejects.toThrow("maximum size");
  });

  test("uploads valid image file", async () => {
    const { user, channel } = makeChannel();
    const content = "fake image data";
    const file = new File([content], "test.png", { type: "image/png" });
    const { upload } = await import("../src/services/image");
    const msg = await upload(file, channel.id, user.id);
    expect(msg.type).toBe("image");
    expect(msg.content).toContain("/uploads/");
    expect(msg.content).toContain(".png");
  });

  test("upload preserves file extension", async () => {
    const { user, channel } = makeChannel();
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const { upload } = await import("../src/services/image");
    const msg = await upload(file, channel.id, user.id);
    expect(msg.content).toContain(".jpg");
  });

  test("defaults to png extension for files without extension", async () => {
    const { user, channel } = makeChannel();
    const file = new File(["data"], "noext", { type: "image/png" });
    const { upload } = await import("../src/services/image");
    const msg = await upload(file, channel.id, user.id);
    expect(msg.content).toContain(".png");
  });
});
