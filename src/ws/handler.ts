// WebSocket Event Handler using Bun Native Pub/Sub

import type { Server, ServerWebSocket } from "bun";
import type { WSData, WSEvent } from "../types.js";
import * as E from "./events.js";

let pubServer: Server;

export function setServer(s: Server) {
  pubServer = s;
}

function publish(channel: string, event: WSEvent) {
  pubServer.publish(channel, JSON.stringify(event));
}

function broadcast(ws: ServerWebSocket<WSData>, channel: string, event: WSEvent) {
  publish(channel, {
    type: event.type,
    payload: {
      ...(event.payload as Record<string, unknown>),
      user_name: ws.data.userName,
      user_type: ws.data.userType,
    },
  });
}

function sendError(ws: ServerWebSocket<WSData>, message: string) {
  ws.send(JSON.stringify({ type: E.EVENT_TYPES.ERROR, payload: { message } }));
}

async function handleJoinChannel(ws: ServerWebSocket<WSData>, payload: unknown) {
  const p = E.validateJoinChannelPayload(payload);
  ws.subscribe(`channel:${p.channel_id}`);
  broadcast(ws, `channel:${p.channel_id}`, {
    type: E.EVENT_TYPES.USER_JOINED,
    payload: {
      channel_id: p.channel_id,
      user_id: ws.data.userId,
      user_name: ws.data.userName,
    },
  });
}

async function handleLeaveChannel(ws: ServerWebSocket<WSData>, payload: unknown) {
  const p = E.validateLeaveChannelPayload(payload);
  ws.unsubscribe(`channel:${p.channel_id}`);
  publish(`channel:${p.channel_id}`, {
    type: E.EVENT_TYPES.USER_LEFT,
    payload: {
      channel_id: p.channel_id,
      user_id: ws.data.userId,
      user_name: ws.data.userName,
    },
  });
}

async function handleMessage(ws: ServerWebSocket<WSData>, payload: unknown) {
  const p = E.validateMessagePayload(payload);
  broadcast(ws, `channel:${p.channel_id}`, {
    type: E.EVENT_TYPES.MESSAGE,
    payload: p,
  });
}

async function handleQuestion(ws: ServerWebSocket<WSData>, payload: unknown) {
  const p = E.validateQuestionPayload(payload);
  broadcast(ws, `channel:${p.channel_id}`, {
    type: E.EVENT_TYPES.QUESTION_OPENED,
    payload: {
      channel_id: p.channel_id,
      question_id: crypto.randomUUID(),
      message_id: crypto.randomUUID(),
      asked_by: ws.data.userId,
      content: p.content,
    },
  });
}

async function handleAnswer(ws: ServerWebSocket<WSData>, payload: unknown) {
  const p = E.validateAnswerPayload(payload);
  broadcast(ws, `channel:${p.channel_id}`, {
    type: E.EVENT_TYPES.QUESTION_ANSWERED,
    payload: {
      channel_id: p.channel_id,
      question_id: p.question_id,
      answered_by: ws.data.userId,
      content: p.content,
    },
  });
}

async function handleTyping(ws: ServerWebSocket<WSData>, payload: unknown) {
  const p = E.validateTypingPayload(payload);
  broadcast(ws, `channel:${p.channel_id}`, {
    type: E.EVENT_TYPES.TYPING,
    payload: p,
  });
}

const handlers: Record<string, (ws: ServerWebSocket<WSData>, payload: unknown) => void> = {
  [E.EVENT_TYPES.MESSAGE]: handleMessage,
  [E.EVENT_TYPES.QUESTION]: handleQuestion,
  [E.EVENT_TYPES.ANSWER]: handleAnswer,
  [E.EVENT_TYPES.JOIN_CHANNEL]: handleJoinChannel,
  [E.EVENT_TYPES.LEAVE_CHANNEL]: handleLeaveChannel,
  [E.EVENT_TYPES.TYPING]: handleTyping,
};

export function onOpen(ws: ServerWebSocket<WSData>) {
  console.log(`[WS] User connected: ${ws.data.userName} (${ws.data.userId})`);
}

export function onMessage(ws: ServerWebSocket<WSData>, raw: string) {
  let event: WSEvent;
  try {
    event = JSON.parse(raw) as WSEvent;
  } catch {
    sendError(ws, "Invalid JSON");
    return;
  }

  if (!event.type || typeof event.type !== "string") {
    sendError(ws, "Event type is required");
    return;
  }

  const handler = handlers[event.type];
  if (!handler) {
    sendError(ws, `Unknown event type: ${event.type}`);
    return;
  }

  try {
    handler(ws, event.payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendError(ws, message);
  }
}

export function onClose(ws: ServerWebSocket<WSData>) {
  console.log(`[WS] User disconnected: ${ws.data.userName} (${ws.data.userId})`);
}
