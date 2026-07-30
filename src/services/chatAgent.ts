import Anthropic from "@anthropic-ai/sdk";
import categories from "../data/categories.json";
import { ModerationRecord } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the assistant layer of a Trust & Safety
content moderation system. You have access to the live moderation log this
session (flagged content, decisions made, rationale, policy references) and
the policy category list. Answer questions about moderation decisions,
policy references, and escalation patterns concisely and factually, citing
specific content IDs or categories where relevant. If asked something
outside this scope, redirect politely. Keep answers to 2-5 sentences unless
the question genuinely requires more.`;

export async function answerQuestion(
  message: string,
  history: ChatMessage[],
  liveRecords: ModerationRecord[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicFallback(message, liveRecords);
  }

  const contextBlock = buildContextBlock(liveRecords);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
      messages: [
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: message },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return (textBlock as any)?.text?.trim() ?? "I wasn't able to generate a response.";
  } catch (err) {
    console.error("Chat agent LLM call failed:", err);
    return heuristicFallback(message, liveRecords);
  }
}

function buildContextBlock(liveRecords: ModerationRecord[]): string {
  const summary = liveRecords.length
    ? liveRecords
        .map(
          (r) =>
            `- [${r.content.id}] ${r.content.category} (${r.decision.severity}) → ${r.decision.action} (${r.decision.confidence} confidence) — ${r.decision.policyReference}`
        )
        .join("\n")
    : "No content has been processed yet in this session.";

  return `LIVE MODERATION LOG (this session):\n${summary}\n\nPOLICY CATEGORIES:\n${JSON.stringify(
    categories,
    null,
    2
  )}`;
}

function heuristicFallback(message: string, liveRecords: ModerationRecord[]): string {
  const lower = message.toLowerCase();

  if (liveRecords.length === 0) {
    return "No content has been processed yet — fire a flagged item from the Moderation Queue first, then ask me about it.";
  }

  if (lower.includes("how many") || lower.includes("count")) {
    return `${liveRecords.length} item(s) have been processed in this session so far.`;
  }

  if (lower.includes("escalat")) {
    const escalated = liveRecords.filter((r) => r.decision.action === "escalate");
    return `${escalated.length} of ${liveRecords.length} item(s) were escalated to human review.`;
  }

  const latest = liveRecords[liveRecords.length - 1];
  return `Here's the most recent item I have: ${latest.content.category.replace("_", " ")} content → ${latest.decision.action} (${latest.decision.confidence} confidence). Policy: ${latest.decision.policyReference}. (Note: connect an ANTHROPIC_API_KEY for full conversational reasoning.)`;
}
