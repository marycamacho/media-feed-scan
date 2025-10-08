#!/usr/bin/env node
// src/scoreAndSelect.js
import fs from "fs";
import path from "path";
import chalk from "chalk";
import config from "../config.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------- paths ----------
const DATA_DIR     = config.DATA_DIR || path.join(__dirname, "..", "data");
const ANALYZED_IN  = path.join(DATA_DIR, "week.curated.json");   // prefer curated if present
const FALLBACK_IN  = path.join(DATA_DIR, "week.analyzed.json");  // else full analyzed
const WEEK_FULL    = path.join(DATA_DIR, "week_full.json");
const WEEK_TOP10   = path.join(DATA_DIR, "week_top10.md");
const BACKLOG_MD   = path.join(DATA_DIR, "backlog_high.md");
const RESEARCH_MD  = path.join(DATA_DIR, "research_queue.md");

// ---------- knobs ----------
const OUTLET_CAP        = config.OUTLET_CAP || 3;                 // max per outlet in pool
const CARRY_THRESHOLD   = config.CARRY_OVER_THRESHOLD || 80;      // carry-over cutoff
const MIN_THEME_SPREAD  = config.MIN_THEME_SPREAD || 3;           // min distinct themes in Top-10

// ---------- helpers ----------
function readJsonSafe(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8") || "null") ?? fallback; }
  catch { return fallback; }
}
function writeJsonPretty(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8"); }
function readMd(p) { return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""; }
function appendMd(p, block) { const prev = readMd(p); fs.writeFileSync(p, `${prev}\n${block}\n`, "utf8"); }
function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }

function outletName(src) {
  if (!src) return "Unknown";
  return src.replace(/^https?:\/\//,"").split(/[\/–-]/)[0].trim();
}

function validRef(url) {
  if (!url) return false;
  // filter feed/social/junk links
  if (/(\.rss|\.xml)(\?|$)/i.test(url)) return false;
  if (/\/feed(\/|$|\?)/i.test(url)) return false;
  if (/news\.google\.com\/rss/i.test(url)) return false;
  if (/^https?:\/\/(twitter|x)\.com\//i.test(url)) return false;
  if (/^https?:\/\/t\.co\//i.test(url)) return false;
  if (/\/tag\//i.test(url)) return false;
  if (/\/category\//i.test(url)) return false;
  return true;
}

// ---------- 1) Load ----------
const INPUT_PATH = fs.existsSync(ANALYZED_IN) ? ANALYZED_IN : FALLBACK_IN;
if (!fs.existsSync(INPUT_PATH)) {
  console.error(chalk.red(`Missing input: ${INPUT_PATH}`));
  console.error(chalk.yellow("Run analyzeBatch.js first."));
  process.exit(1);
}
const items = readJsonSafe(INPUT_PATH, []);
if (!items.length) { console.log(chalk.yellow("No analyzed items.")); process.exit(0); }
console.log(chalk.cyan(`Scoring ${items.length} items from ${path.basename(INPUT_PATH)}...`));

// ---------- 1b) Salvage pass for promising snippets/fails ----------
const rescued = items.filter(it =>
  (it.fulltext_quality === "snippet" || it.fulltext_quality === "fail") &&
  (it.analysis?.why_it_matters || "").length > 80
);
const rescuedUrls = new Set(rescued.map(r => r.url));
console.log(chalk.magenta(`Rescued snippet/fail items: ${rescued.length}`));

// ---------- 2) Compute raw + normalize to 0–100 ----------
function rawScore(a) {
  const m = a.analysis || {};
  const rel = m.relevance_score ?? 0;            // 0–5
  const pot = m.insight_potential ?? 0;          // 0–5
  const ev  = (m.evidence_hooks?.length || 0);   // count
  const tim = m.timely_hook ? 1 : 0;             // 0/1
  const risk = m.alignment_risk ?? 0;            // 0–5

  // Heavier weight on insight potential (non-linear), moderate on relevance/evidence, penalize risk
  return (rel * 1.5) + (Math.pow(pot, 1.5) * 2.5) + (ev * 1.2) + tim - (risk * 1.5);
}

const raws = items.map(rawScore);
const min = Math.min(...raws);
const max = Math.max(...raws);
const norm = v => Math.round(((v - min) / (max - min || 1)) * 100);

const scored = items.map((it, idx) => {
  let s = norm(raws[idx]);
  if (rescuedUrls.has(it.url)) s = Math.min(100, s + 8); // nudge rescued items
  return { ...it, final_score: s, rescued: rescuedUrls.has(it.url) };
}).sort((a,b)=>b.final_score - a.final_score);

// optional diagnostics
console.log(chalk.gray(`Score range (raw): ${min.toFixed(2)} → ${max.toFixed(2)}  | normalized 0–100`));
console.log(chalk.gray(`Top 5 now: ${scored.slice(0,5).map(x=>x.final_score).join(", ")}`));

// ---------- 3) Build candidate pool (respect outlet caps; prioritize rescued) ----------
const outletCounts = {};     // <-- define it here
const pool = [];

// 3a) add rescued first
for (const it of scored.filter(x => x.rescued)) {
  const out = outletName(it.source);
  if ((outletCounts[out] || 0) >= OUTLET_CAP) continue;
  pool.push(it);
  outletCounts[out] = (outletCounts[out] || 0) + 1;
}

// 3b) fill with top non-rescued
for (const it of scored.filter(x => !x.rescued)) {
  const out = outletName(it.source);
  if ((outletCounts[out] || 0) >= OUTLET_CAP) continue;
  pool.push(it);
  outletCounts[out] = (outletCounts[out] || 0) + 1;
  if (pool.length >= 50) break; // working pool size
}

// ---------- 3c) Theme-spread Top-10 from pool ----------
const top10 = [];
const seenThemes = new Set();

for (const it of pool) {
  const themes = (it.analysis?.themes || []).map(t => t.toLowerCase());
  const uniqueNew = themes.some(t => !seenThemes.has(t));
  if (top10.length < 10 || uniqueNew || seenThemes.size < MIN_THEME_SPREAD) {
    top10.push(it);
    themes.forEach(t => seenThemes.add(t));
  }
  if (top10.length >= 10 && seenThemes.size >= MIN_THEME_SPREAD) break;
}

// ---------- 4) Carry-over & Research queue ----------
const dt = new Date().toISOString().split("T")[0];

// 4a) carry-over (≥ threshold)
const carry = scored.filter(it => it.final_score >= CARRY_THRESHOLD);
if (carry.length) {
  const block = [
    `# Carry-Over Bank — ${dt}\n`,
    ...carry.map(it =>
      `## ${it.source || "Unknown"} — “${it.title}” (Score ${it.final_score})\n` +
      `**URL:** ${it.url}\n**Themes:** ${(it.analysis?.themes||[]).join(", ")}\n` +
      `**Why Keep:** ${it.analysis?.why_it_matters || ""}\n---\n`
    )
  ].join("\n");
  appendMd(BACKLOG_MD, block);
}

// 4b) research queue (unique, valid refs)
const refs = uniq(
  scored.flatMap(it => it.analysis?.primary_references || []).filter(validRef)
);
if (refs.length) {
  const block = [
    `# Research & Policy Sources — ${dt}\n`,
    ...refs.map(r => `- ${r}`),
    "\n---\n"
  ].join("\n");
  appendMd(RESEARCH_MD, block);
}

// ---------- 5) Write outputs ----------
writeJsonPretty(WEEK_FULL, scored);

const topMd = [
  `# Weekly Top-10 — ${dt}\n`,
  ...top10.map((it,i)=>
    `## ${i+1}. ${it.source || "Unknown"} — “${it.title}” (Score ${it.final_score}${it.rescued ? ", rescued" : ""})\n` +
    `**URL:** ${it.url}\n` +
    `**Themes:** ${(it.analysis?.themes||[]).join(", ")}\n` +
    `**Why It Matters:** ${it.analysis?.why_it_matters || ""}\n` +
    `**Angles:** ${(it.analysis?.insight_angles||[]).map(a=>a.angle).join(", ")}\n` +
    `---\n`
  )
].join("\n");
fs.writeFileSync(WEEK_TOP10, topMd, "utf8");

// ---------- 6) Summary ----------
console.log(chalk.green(`\n→ ${WEEK_TOP10}`));
console.log(chalk.gray(`→ ${BACKLOG_MD}`));
console.log(chalk.gray(`→ ${RESEARCH_MD}`));
console.log(chalk.gray(`→ ${WEEK_FULL}`));
console.log(chalk.yellow(`Top-10 ready (${top10.length} items, ${seenThemes.size} unique themes)`));

process.exit(0);
