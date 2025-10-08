// src/analyzeOne.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import config from "../config.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PATH = config.PROMPT_PATH || path.join(__dirname, "..", "prompts", "cirdia_system_prompt.txt");
const MODEL = (config.OPENAI_MODELS && config.OPENAI_MODELS.ANALYZE) || "gpt-4o-mini";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SYSTEM = fs.readFileSync(SYSTEM_PATH, "utf8");

// One schema to rule them all
export const ANALYSIS_SCHEMA = `{
  "relevance_score": 0,
  "insight_potential": 0,
  "evidence_hooks": [],
  "timely_hook": "",
  "alignment_risk": 0,
  "themes": [],
  "why_it_matters": "",
  "tensions_or_blindspots": [],
  "insight_angles": [
    {"angle": "", "one_liner": "", "supporting_points": []}
  ],
  "primary_references": [],   // URLs/DOIs/policy docs mentioned or linked
  "notes": ""
}`;

export async function analyzeOneItem(item) {
  const articleBody = item.textPreview || item.summary || "";

  const userPrompt = `
TASK: Analyze the article using Cirdia’s lens and return ONLY JSON matching the schema. 
Focus on insight potential and primary sources. Do NOT draft posts.

ARTICLE METADATA:
Title: ${item.title || ""}
Source: ${item.source || ""}
URL: ${item.url}
Published: ${item.published || ""}
Fulltext quality: ${item.fulltext_quality || ""}

ARTICLE TEXT (excerpt):
${articleBody}

SCHEMA:
${ANALYSIS_SCHEMA}
`.trim();

  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt }
    ]
  });

  const json = JSON.parse(resp.choices[0].message.content);
  return { ...item, analysis: json };
}

