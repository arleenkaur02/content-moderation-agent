import "dotenv/config";
import mockContent from "./data/mockContent.json";
import { FlaggedContent } from "./types";
import { handleFlaggedContent } from "./orchestrator";

async function main() {
  console.log("Content Moderation Agent — simulation run\n" + "=".repeat(60));

  for (const content of mockContent as FlaggedContent[]) {
    console.log(`\n▶ Processing ${content.id} (${content.category}, ${content.reportCount} reports)`);
    const record = await handleFlaggedContent(content);

    console.log(`  Action: ${record.decision.action} (${record.decision.confidence} confidence)`);
    console.log(`  Severity: ${record.decision.severity}, False positive likelihood: ${record.decision.falsePositiveLikelihood}`);
    console.log(`  Rationale: ${record.decision.rationale}`);
    console.log(`  Policy: ${record.decision.policyReference}`);
    console.log("-".repeat(60));
  }

  console.log("\nSimulation complete.");
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
