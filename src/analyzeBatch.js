#!/usr/bin/env node
// src/analyzeBatch.js
import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import chalk from "chalk";
import crypto from "crypto";
import config from "../config.js";
import { analyzeOneItem } from "./analyzeOne.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = config.DATA_DIR || path.join(__dirname, "..", "data");

// Prefer your curated set (if you manually pruned) else use week.text.json
const CURATED_IN = path.join(DATA_DIR, "week.curated.json");
const TEXT_IN = path.join(DATA_DIR, "week.text.json");
const IN_PATH = fs.existsSync(CURATED_IN) ? CURATED_IN : TEXT_IN;

const OUT_PATH = path.join(DATA_DIR, "week.analyzed.json");
const CACHE_PATH = path.join(DATA_DIR, ".analysis.cache.json");

const CONCURRENCY = config.CONCURRENCY || 5;
const FULLTEXT_POLICY = (config.FULLTEXT_POLICY || "preferred").toLowerCase(); // defensive recheck

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8") || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJsonPretty(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function contentKey(it) {
  // Prefer stable content hash from fetchText; fallback to URL hash.
  const base = it.contentHash || crypto.createHash("sha1").update(it.url || "").digest("hex");
  // Include model name in key in case you change models later.
  const model = (config.OPENAI_MODELS && config.OPENAI_MODELS.ANALYZE) || "gpt-4o-mini";
  return `${base}:${model}`;
}

(async function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error(chalk.red(`Missing input: ${IN_PATH}`));
    console.error(chalk.yellow(`Run: node src/fetchText.js first (or create week.curated.json).`));
    process.exit(1);
  }

  const items = readJsonSafe(IN_PATH, []);
  if (!items.length) {
    console.log(chalk.yellow("No items to analyze."));
    writeJsonPretty(OUT_PATH, []);
    process.exit(0);
  }

  // Defensive: re-apply text-quality gate (should already be filtered upstream)
  const allowed = items.filter(p => {
    if (FULLTEXT_POLICY === "required") return p.fulltext_quality === "full";
    if (FULLTEXT_POLICY === "preferred") return p.fulltext_quality === "full" || p.fulltext_quality === "partial";
    return true; // 'off'
  });

  console.log(chalk.cyan(`Analyzing ${allowed.length}/${items.length} items… (model: ${config.OPENAI_MODELS?.ANALYZE || "gpt-4o-mini"})`));

  const limit = pLimit(CONCURRENCY);
  const cache = readJsonSafe(CACHE_PATH, {});

  const results = await Promise.all(
    allowed.map(it => limit(async () => {
      const key = contentKey(it);
      if (cache[key]) return cache[key]; // cache hit

      try {
        const analyzed = await analyzeOneItem(it);
        cache[key] = analyzed;
        return analyzed;
      } catch (e) {
        return { ...it, error: e?.message || "analysis failed" };
      }
    }))
  );

  // Persist outputs & cache
  writeJsonPretty(OUT_PATH, results);
  writeJsonPretty(CACHE_PATH, cache);

  const ok = results.filter(r => !r.error).length;
  const failed = results.length - ok;

  console.log(chalk.green(`\nSaved ${ok} analyzed items → ${OUT_PATH}`));
  if (failed) console.log(chalk.red(`${failed} failed analyses (see entries with "error")`));
  console.log(chalk.gray(`Cache: ${Object.keys(cache).length} entries → ${CACHE_PATH}`));

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
