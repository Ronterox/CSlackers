import { mkdir } from "fs/promises";
import { join } from "path";
import type { Message } from "../types.js";
import { MAX_IMAGE_SIZE } from "../types.js";
import { send } from "./message.js";

const UPLOAD_DIR = "data/uploads";
const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);

async function ensureUploadDir() { try { await mkdir(UPLOAD_DIR, { recursive: true }); } catch { /* exists */ } }

export async function upload(file: File, channelId: string, userId: string): Promise<Message> {
  if (file.size > MAX_IMAGE_SIZE) throw new Error(`Image exceeds maximum size of ${MAX_IMAGE_SIZE} bytes`);
  await ensureUploadDir();
  const id = crypto.randomUUID();
  const rawExt = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "png";
  const ext = rawExt && ALLOWED_EXT.has(rawExt) ? rawExt : "png";
  const filename = `${id}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  const buffer = await file.arrayBuffer();
  await Bun.write(filepath, buffer);
  return send(channelId, userId, "image", `/uploads/${filename}`);
}
