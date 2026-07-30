import { v4 as uuidv4 } from "uuid";
import { FlaggedContent, ModerationRecord } from "./types";
import { classifyContent } from "./services/classificationEngine";

/**
 * Runs the full moderation pipeline for a single flagged content item:
 *
 *   Flagged Content ──▶ Classification Engine (LLM + policy heuristics)
 *                              │
 *                    action + severity + false-positive
 *                    likelihood + confidence + rationale
 */
export async function handleFlaggedContent(content: FlaggedContent): Promise<ModerationRecord> {
  const decision = await classifyContent(content);

  return {
    id: uuidv4(),
    content,
    decision,
    createdAt: new Date().toISOString(),
  };
}
