import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let db: Database;

export function initDB(path = "data/cslackers.db"): Database {
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  migrate(db);
  return db;
}

export function getDB(): Database {
  if (!db) return initDB();
  return db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'agent',
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      purpose TEXT DEFAULT '',
      created INTEGER NOT NULL,
      creator TEXT NOT NULL REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (channel_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      reply_to TEXT,
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_msg_channel
      ON messages(channel_id, created);
    CREATE INDEX IF NOT EXISTS idx_msg_content
      ON messages(content);
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id),
      asked_by TEXT NOT NULL REFERENCES users(id),
      answered_by TEXT REFERENCES users(id),
      answer_msg TEXT REFERENCES messages(id),
      status TEXT NOT NULL DEFAULT 'open',
      created INTEGER NOT NULL,
      resolved INTEGER
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created INTEGER NOT NULL
    );
  `);
}

export const stmts = () => {
  const d = getDB();
  return {
    insertUser: d.prepare("INSERT INTO users (id, name, type, created) VALUES (?, ?, ?, ?)"),
    getUser: d.prepare("SELECT * FROM users WHERE id = ?"),
    insertChannel: d.prepare("INSERT INTO channels (id, name, purpose, created, creator) VALUES (?, ?, ?, ?, ?)"),
    getChannel: d.prepare("SELECT * FROM channels WHERE id = ?"),
    getChannelByName: d.prepare("SELECT * FROM channels WHERE name = ?"),
    listChannels: d.prepare("SELECT * FROM channels ORDER BY created DESC"),
    deleteChannel: d.prepare("DELETE FROM channels WHERE id = ?"),
    joinChannel: d.prepare("INSERT INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)"),
    leaveChannel: d.prepare("DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?"),
    getMembers: d.prepare("SELECT u.* FROM users u JOIN channel_members cm ON u.id = cm.user_id WHERE cm.channel_id = ?"),
    isMember: d.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?"),
    insertMessage: d.prepare("INSERT INTO messages (id, channel_id, user_id, type, content, reply_to, created) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    getMessages: d.prepare("SELECT m.*, u.name as user_name, u.type as user_type FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = ? ORDER BY m.created DESC LIMIT ? OFFSET ?"),
    getMessage: d.prepare("SELECT * FROM messages WHERE id = ?"),
    insertQuestion: d.prepare("INSERT INTO questions (id, message_id, asked_by, status, created) VALUES (?, ?, ?, 'open', ?)"),
    getQuestion: d.prepare("SELECT * FROM questions WHERE id = ?"),
    getOpenQuestions: d.prepare("SELECT * FROM questions WHERE status = 'open' ORDER BY created DESC"),
    answerQuestion: d.prepare("UPDATE questions SET status = 'answered', answered_by = ?, answer_msg = ?, resolved = ? WHERE id = ?"),
    insertToken: d.prepare("INSERT INTO tokens (token, user_id, created) VALUES (?, ?, ?)"),
    getToken: d.prepare("SELECT * FROM tokens WHERE token = ?"),
    searchByChannel: d.prepare("SELECT m.*, u.name as user_name FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = ? ORDER BY m.created DESC"),
    searchAll: d.prepare("SELECT m.*, u.name as user_name FROM messages m JOIN users u ON m.user_id = u.id ORDER BY m.created DESC"),
  };
};
