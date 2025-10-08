// config.js
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // === Core Paths ===
  OPML_PATH: path.join(__dirname, "radar.opml"),     // your renamed OPML file
  DATA_DIR: path.join(__dirname, "data"),
  PROMPT_PATH: path.join(__dirname, "prompts", "cirdia_system_prompt.txt"),

  // === Feed Pull Settings ===
  DAYS_BACK: 7,
  MAX_ITEMS_PER_FEED: 25,
  CONCURRENCY: 5,             // how many feeds to fetch at once

  // === Scoring + Diversity ===
  CARRY_OVER_THRESHOLD: 80,   // keep ≥80-scoring items across weeks
  OUTLET_CAP: 3,              // max 3 articles from the same outlet
  MIN_THEME_SPREAD: 3,

  // === Competitors to flag ===
  COMPETITOR_DOMAINS: [
    "ouraring.com",
    "fitbit.com",
    "garmin.com",
    "apple.com",
    "whoop.com"
  ],

  // === Behavior ===
  TIMEZONE: "Europe/Madrid",
  FULLTEXT_POLICY: "preferred",   // 'required' | 'preferred' | 'off'

  // === OpenAI Model Defaults ===
  OPENAI_MODELS: {
    ANALYZE: "gpt-4o-mini",
    POLISH: "gpt-4o"
  }
};
