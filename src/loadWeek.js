#!/usr/bin/env node
import fs from "fs";
import path from "path";
import chalk from "chalk";
import config from "../config.js";
import { fileURLToPath } from "url";
import { TOPIC_BUCKETS } from "./topics.js";   // ← NEW: topic prior

// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = config.DATA_DIR || path.join(__dirname, "..", "data");
const RAW_PATH = path.join(DATA_DIR, "week.raw.json");
const OUT_PATH = path.join(DATA_DIR, "week.json");
const SEEN_PATH = path.join(DATA_DIR, "seen_urls.json");
const COMPETITORS = (config.COMPETITOR_DOMAINS || []).map(d => d.toLowerCase());

// -------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const txt = fs.readFileSync(p, "utf-8");
    return JSON.parse(txt || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJsonPretty(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function dedupeKey(href) {
  try {
    const u = new URL(href);
    u.search = "";                     // drop all query params for stronger dedupe
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./, "");
    // normalize trailing slash
    let path = u.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${u.origin}${path}`;
  } catch {
    return href;
  }
}

function isCompetitor(url) {
  try {
    const u = new URL(url.toLowerCase());
    const host = u.hostname.replace(/^www\./, "");
    return COMPETITORS.some(dom => host.endsWith(dom));
  } catch {
    return false;
  }
}

// NEW: topic tagging from title+summary (keyword prior)
function tagTopics(item) {
  const hay = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  const hits = [];
  for (const [topic, regs] of Object.entries(TOPIC_BUCKETS)) {
    if (regs.some(r => r.test(hay))) hits.push(topic);
  }
  return hits;
}

// -------------------------
(async function main() {
  ensureDir(DATA_DIR);

  if (!fs.existsSync(RAW_PATH)) {
    console.error(chalk.red(`Missing input: ${RAW_PATH}`));
    console.error(chalk.yellow(`Run: node src/pullFromOpml.js first.`));
    process.exit(1);
  }

  const raw = readJsonSafe(RAW_PATH, []);
  const seenList = readJsonSafe(SEEN_PATH, []);
  const seen = new Set(seenList);
  const byKey = new Set();

  let inputCount = raw.length;
  let droppedSeen = 0;
  let kept = [];

  for (const it of raw) {
    const key = dedupeKey(it.url || it.link || "");
    if (!key) continue;

    // cross-week dedupe
    if (seen.has(key)) { droppedSeen++; continue; }

    // intra-batch dedupe
    if (byKey.has(key)) continue;
    byKey.add(key);

    // compute topic prior
    const topic_hits = tagTopics(it);

    kept.push({
      title: it.title || "",
      url: it.url || it.link || "",
      published: it.published || it.pubDate || "",
      source: it.source || "",
      summary: it.summary || "",
      feed_url: it.feed_url || "",
      competitor: isCompetitor(it.url || it.link || ""),
      // NEW: priors for scoring
      topic_hits,
      topic_hit_count: topic_hits.length
    });
  }

  // Persist working set
  writeJsonPretty(OUT_PATH, kept);

  // Update seen_urls (append new keys)
  const updatedSeen = [...seen, ...[...byKey].filter(k => !seen.has(k))];
  writeJsonPretty(SEEN_PATH, updatedSeen);

  // Summary
  const competitorCount = kept.filter(k => k.competitor).length;
  console.log(chalk.cyan(`\nLoaded ${inputCount} items from week.raw.json`));
  console.log(chalk.yellow(`Dropped (previously seen): ${droppedSeen}`));
  console.log(chalk.green(`Kept for analysis: ${kept.length}`));
  console.log(chalk.magenta(`…of which competitors: ${competitorCount}`));
  console.log(chalk.gray(`→ Wrote ${OUT_PATH}`));
  console.log(chalk.gray(`→ Updated ${SEEN_PATH}`));

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

