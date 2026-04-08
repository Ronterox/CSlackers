import { stmts } from "../db.js";
import type { Question, Message } from "../types.js";
import { send } from "./message.js";

export function ask(channelId: string, userId: string, content: string): { question: Question; message: Message } {
  const msg = send(channelId, userId, "question", content);
  const id = crypto.randomUUID();
  const created = Date.now();
  stmts().insertQuestion.run(id, msg.id, userId, created);
  const question = stmts().getQuestion.get(id) as Question;
  return { question, message: msg };
}

export function answer(questionId: string, userId: string, content: string): { question: Question; answerMessage: Message } {
  const question = stmts().getQuestion.get(questionId) as Question | null;
  if (!question) throw new Error("Question not found");
  if (question.status !== "open") throw new Error("Question already answered");
  if (question.asked_by === userId) throw new Error("Cannot answer your own question");
  const answerMsg = send(stmts().getMessage.get(question.message_id)?.channel_id || "", userId, "text", content);
  const resolved = Date.now();
  stmts().answerQuestion.run(userId, answerMsg.id, resolved, questionId);
  const updated = stmts().getQuestion.get(questionId) as Question;
  return { question: updated, answerMessage: answerMsg };
}

export async function wait(questionId: string, timeout: number = 30000): Promise<Question> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const question = stmts().getQuestion.get(questionId) as Question | null;
    if (!question) throw new Error("Question not found");
    if (question.status !== "open") return question;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Timeout waiting for answer");
}

export function listOpen(): Question[] { return stmts().getOpenQuestions.all() as Question[]; }
