import { describe, test, expect, beforeEach } from "bun:test";
import { resetDB, makeUser, makeChannel } from "./helpers";
import * as questionService from "../src/services/question";
import * as channelService from "../src/services/channel";

describe("Question Service", () => {
  beforeEach(resetDB);

  test("agent asks a question", () => {
    const { user: human, channel } = makeChannel("human", "general");
    const { user: agent } = makeUser("agent1", "agent");
    channelService.join(channel.id, agent.id);
    const { question, message } = questionService.ask(channel.id, agent.id, "Should I proceed?");
    expect(question.status).toBe("open");
    expect(message.type).toBe("question");
    expect(message.content).toBe("Should I proceed?");
  });

  test("human answers a question", () => {
    const { user: human, channel } = makeChannel("human", "general");
    const { user: agent } = makeUser("agent1", "agent");
    channelService.join(channel.id, agent.id);
    const { question } = questionService.ask(channel.id, agent.id, "Continue?");
    const result = questionService.answer(question.id, human.id, "Yes, continue");
    expect(result.question.status).toBe("answered");
    expect(result.question.answered_by).toBe(human.id);
    expect(result.answerMessage.content).toBe("Yes, continue");
  });

  // Double-answer
  test("rejects answering already answered question", () => {
    const { user: human, channel } = makeChannel("human", "general");
    const { user: agent } = makeUser("agent1", "agent");
    channelService.join(channel.id, agent.id);
    const { question } = questionService.ask(channel.id, agent.id, "Q?");
    questionService.answer(question.id, human.id, "A1");
    expect(() => questionService.answer(question.id, human.id, "A2")).toThrow("already answered");
  });

  // Self-answer
  test("agent cannot answer own question", () => {
    const { user: agent } = makeUser("agent1", "agent");
    const { channel } = makeChannel("human", "general");
    channelService.join(channel.id, agent.id);
    const { question } = questionService.ask(channel.id, agent.id, "Self?");
    expect(() => questionService.answer(question.id, agent.id, "Self answer")).toThrow("own question");
  });

  // E-06: Question timeout
  test("wait times out when no answer", async () => {
    const { user: agent } = makeUser("agent1", "agent");
    const { channel } = makeChannel("human", "general");
    channelService.join(channel.id, agent.id);
    const { question } = questionService.ask(channel.id, agent.id, "Timeout?");
    await expect(questionService.wait(question.id, 500)).rejects.toThrow("Timeout");
  });

  test("wait resolves when answered", async () => {
    const { user: human, channel } = makeChannel("human", "general");
    const { user: agent } = makeUser("agent1", "agent");
    channelService.join(channel.id, agent.id);
    const { question } = questionService.ask(channel.id, agent.id, "Resolve?");
    // Answer after short delay
    setTimeout(() => questionService.answer(question.id, human.id, "Delayed answer"), 100);
    const result = await questionService.wait(question.id, 2000);
    expect(result.status).toBe("answered");
  });

  test("lists only open questions", () => {
    const { user: human, channel } = makeChannel("human", "general");
    const { user: agent } = makeUser("agent1", "agent");
    channelService.join(channel.id, agent.id);
    const q1 = questionService.ask(channel.id, agent.id, "Q1");
    questionService.ask(channel.id, agent.id, "Q2");
    questionService.answer(q1.question.id, human.id, "A1");
    const open = questionService.listOpen();
    expect(open.length).toBe(1);
    expect(open[0].id).not.toBe(q1.question.id);
  });

  test("answer nonexistent question throws", () => {
    const { user } = makeUser("bob");
    expect(() => questionService.answer("nonexistent", user.id, "nope")).toThrow("not found");
  });
});
