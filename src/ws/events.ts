// WebSocket Event Type Definitions and Validators

export const EVENT_TYPES = {
  MESSAGE: "message",
  QUESTION: "question",
  ANSWER: "answer",
  JOIN_CHANNEL: "join_channel",
  LEAVE_CHANNEL: "leave_channel",
  TYPING: "typing",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  QUESTION_OPENED: "question_opened",
  QUESTION_ANSWERED: "question_answered",
  ERROR: "error",
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export interface MessagePayload {
  channel_id: string;
  content: string;
}

export interface QuestionPayload {
  channel_id: string;
  content: string;
}

export interface AnswerPayload {
  question_id: string;
  content: string;
}

export interface JoinChannelPayload {
  channel_id: string;
}

export interface LeaveChannelPayload {
  channel_id: string;
}

export interface TypingPayload {
  channel_id: string;
  typing: boolean;
}

export interface ErrorPayload {
  message: string;
}

export interface UserJoinedPayload {
  channel_id: string;
  user_id: string;
  user_name: string;
}

export interface QuestionOpenedPayload {
  channel_id: string;
  question_id: string;
  message_id: string;
  asked_by: string;
  content: string;
}

export interface QuestionAnsweredPayload {
  channel_id: string;
  question_id: string;
  answered_by: string;
  content: string;
}

function validateString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

export function validateMessagePayload(payload: unknown): MessagePayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Message payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  return {
    channel_id: validateString(p.channel_id, "channel_id"),
    content: validateString(p.content, "content"),
  };
}

export function validateQuestionPayload(payload: unknown): QuestionPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Question payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  return {
    channel_id: validateString(p.channel_id, "channel_id"),
    content: validateString(p.content, "content"),
  };
}

export function validateAnswerPayload(payload: unknown): AnswerPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Answer payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  return {
    question_id: validateString(p.question_id, "question_id"),
    content: validateString(p.content, "content"),
  };
}

export function validateJoinChannelPayload(payload: unknown): JoinChannelPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Join channel payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  return {
    channel_id: validateString(p.channel_id, "channel_id"),
  };
}

export function validateLeaveChannelPayload(payload: unknown): LeaveChannelPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Leave channel payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  return {
    channel_id: validateString(p.channel_id, "channel_id"),
  };
}

export function validateTypingPayload(payload: unknown): TypingPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Typing payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  return {
    channel_id: validateString(p.channel_id, "channel_id"),
    typing: validateBoolean(p.typing, "typing"),
  };
}
