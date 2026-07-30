export type ContentType = "text" | "image" | "video";
export type PolicyCategory =
  | "hate_speech"
  | "violence"
  | "spam"
  | "self_harm"
  | "harassment"
  | "misinformation";
export type ModerationAction = "auto_remove" | "auto_approve" | "escalate";

export interface FlaggedContent {
  id: string;
  contentType: ContentType;
  category: PolicyCategory;
  caption: string;
  thumbnailUrl: string;
  reportCount: number;
  authorPriorViolations: number;
  platform: string;
  timestamp: string;
}

export interface ModerationDecision {
  action: ModerationAction;
  severity: "low" | "medium" | "high" | "critical";
  falsePositiveLikelihood: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  rationale: string;
  policyReference: string;
}

export interface ModerationRecord {
  id: string;
  content: FlaggedContent;
  decision: ModerationDecision;
  createdAt: string;
}
