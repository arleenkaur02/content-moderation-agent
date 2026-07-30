import Anthropic from "@anthropic-ai/sdk";
import { FlaggedContent, ModerationDecision } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a Trust & Safety content moderation agent. You
are given a piece of flagged content (metadata only — category, caption/
description, report count, author violation history) and must decide:

- "auto_remove": clear, unambiguous policy violation — safe to action without human review
- "auto_approve": clearly NOT a violation (false positive) — safe to dismiss without human review
- "escalate": ambiguous, high-stakes, or borderline — requires human judgment

Weigh report count, author's prior violation history, and category severity
together. Self-harm and violence content should have a strong bias toward
escalation over auto-removal, since these often need careful human handling
rather than blunt auto-actioning — err toward escalate when in doubt for
these categories. Clear spam with a repeat pattern is safe to auto-remove.

Respond ONLY as JSON, no prose outside the JSON:
{
  "action": "auto_remove" | "auto_approve" | "escalate",
  "severity": "low" | "medium" | "high" | "critical",
  "falsePositiveLikelihood": "low" | "medium" | "high",
  "confidence": "low" | "medium" | "high",
  "rationale": string (2-3 sentences, reference specific details from the content),
  "policyReference": string (a short plausible policy section name, e.g. "Community Guidelines 3.2 — Targeted Harassment")
}`;

interface LLMDecision {
  action: ModerationDecision["action"];
  severity: ModerationDecision["severity"];
  falsePositiveLikelihood: ModerationDecision["falsePositiveLikelihood"];
  confidence: ModerationDecision["confidence"];
  rationale: string;
  policyReference: string;
}

export async function classifyContent(content: FlaggedContent): Promise<ModerationDecision> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicDecision(content);
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(content, null, 2) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed: LLMDecision = JSON.parse((textBlock as any)?.text?.trim() ?? "{}");
    return parsed;
  } catch (err) {
    console.error("Classification engine LLM call failed, using fallback:", err);
    return heuristicDecision(content);
  }
}

const policyRefByCategory: Record<string, string> = {
  hate_speech: "Community Guidelines 2.1 — Hate Speech",
  violence: "Community Guidelines 2.3 — Violent Content",
  spam: "Community Guidelines 5.1 — Spam & Platform Manipulation",
  self_harm: "Community Guidelines 2.5 — Self-Harm & Suicide",
  harassment: "Community Guidelines 3.2 — Targeted Harassment",
  misinformation: "Community Guidelines 4.1 — Misleading Claims",
};

function heuristicDecision(content: FlaggedContent): ModerationDecision {
  const policyReference = policyRefByCategory[content.category] ?? "Community Guidelines — General";

  // Self-harm and violence: strong bias toward escalation.
  if (content.category === "self_harm" || content.category === "violence") {
    return {
      action: "escalate",
      severity: "critical",
      falsePositiveLikelihood: "low",
      confidence: "high",
      rationale: `Content in the ${content.category.replace("_", " ")} category is routed for human review regardless of report volume, given the stakes of getting this category wrong in either direction. ${content.reportCount} report(s) and ${content.authorPriorViolations} prior violation(s) are included in the review context.`,
      policyReference,
    };
  }

  // Spam: clear pattern, high report count, low prior violations tolerance — safe to auto-remove.
  if (content.category === "spam") {
    const clearSpam = content.reportCount >= 3;
    return {
      action: clearSpam ? "auto_remove" : "escalate",
      severity: "low",
      falsePositiveLikelihood: clearSpam ? "low" : "medium",
      confidence: clearSpam ? "high" : "medium",
      rationale: clearSpam
        ? `Repeated posting pattern with ${content.reportCount} reports is a clear, low-ambiguity spam signal — safe to auto-remove without human review.`
        : `Report volume (${content.reportCount}) is low enough that this may be a false positive; routed for confirmation.`,
      policyReference,
    };
  }

  // Harassment / misinformation / hate speech: weigh report count + prior violations.
  const highSignal = content.reportCount >= 8 || content.authorPriorViolations >= 2;
  const lowSignal = content.reportCount <= 2 && content.authorPriorViolations === 0;

  if (highSignal) {
    return {
      action: "auto_remove",
      severity: content.category === "hate_speech" ? "high" : "medium",
      falsePositiveLikelihood: "low",
      confidence: "high",
      rationale: `High report volume (${content.reportCount}) combined with ${content.authorPriorViolations} prior violation(s) from this author is a strong, low-ambiguity signal — auto-actioned per policy.`,
      policyReference,
    };
  }

  if (lowSignal) {
    return {
      action: "escalate",
      severity: "medium",
      falsePositiveLikelihood: "medium",
      confidence: "medium",
      rationale: `Limited report volume (${content.reportCount}) and no prior violation history make this ambiguous enough to warrant human review rather than an automatic decision.`,
      policyReference,
    };
  }

  return {
    action: "escalate",
    severity: "medium",
    falsePositiveLikelihood: "medium",
    confidence: "medium",
    rationale: `Signal is mixed (${content.reportCount} reports, ${content.authorPriorViolations} prior violations) — routed to a human reviewer rather than auto-actioned.`,
    policyReference,
  };
}
