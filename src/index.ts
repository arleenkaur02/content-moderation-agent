import "dotenv/config";
import path from "path";
import express from "express";
import { FlaggedContent } from "./types";
import { handleFlaggedContent } from "./orchestrator";
import { addRecord, getAllRecords, getRecordById } from "./moderationStore";
import { answerQuestion, ChatMessage } from "./services/chatAgent";
import categories from "./data/categories.json";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const port = process.env.PORT ?? 4000;

app.post("/webhooks/flagged-content", async (req, res) => {
  const content = req.body as FlaggedContent;

  if (!content?.category || !content?.caption) {
    return res.status(400).json({ error: "Malformed flagged content payload" });
  }

  try {
    const record = await handleFlaggedContent(content);
    addRecord(record);
    return res.status(200).json(record);
  } catch (err) {
    console.error("Failed to process flagged content:", err);
    return res.status(500).json({ error: "Internal error processing content" });
  }
});

app.get("/moderation", (_req, res) => {
  res.json(getAllRecords());
});

app.get("/moderation/:id", (req, res) => {
  const record = getRecordById(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

app.get("/categories", (_req, res) => {
  res.json(categories);
});

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body as { message: string; history?: ChatMessage[] };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' field" });
  }

  try {
    const reply = await answerQuestion(message, history ?? [], getAllRecords());
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat agent failed:", err);
    return res.status(500).json({ error: "Chat agent failed to respond" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(port, () => {
  console.log(`Content Moderation Agent listening on port ${port}`);
  console.log(`POST flagged content to http://localhost:${port}/webhooks/flagged-content`);
});
