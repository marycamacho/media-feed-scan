#!/usr/bin/env node
// src/fetchText.js

import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import pLimit from "p-limit";
import chalk from "chalk";
import crypto from "crypto";
import config from "../config.js";
import { fileURLToPath } from "url";

// ---------- paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = config.DATA_DIR || path.join(__dirname, "..", "data");
const IN_PATH = path.join(DATA_DIR, "week.json");
const OUT_PATH = path.join(DATA_DIR, "week.text.json");
const FETCH_LATER_MD = path.join(DATA_DIR, "fetch_later.md");

const CONCURRENCY = config.CONCURRENCY || 5;
const FULLTEXT_POLICY = "preferred"; // or "off" for a broader pull

// ---------- helpers ----------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function hash(str) {
  return crypto.createHash("sha1").update(str || "").digest("hex");
}

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "media-feed-scan/1.0 (+https://example.com)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function extractMainText(html, url) {
  if (!html) return { text: "", by: "none" };

  try {
    // 1) Readability first
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article?.textContent && article.textContent.trim().length > 0) {
      return { text: article.textContent.trim(), by: "readability" };
    }

    // 2) Plain DOM fallback: prefer <article> or <main>, else body text
    const doc = dom.window.document;
    const target =
      doc.querySelector("article") ||
      doc.querySelector("main") ||
      doc.body;
    const text = (target?.textContent || "").replace(/\s+\n/g, "\n").trim();
    if (text.length > 0) {
      return { text, by: "dom-fallback" };
    }
  } catch (_) {}

  return { text: "", by: "none" };
}

function classifyQuality(text, extractor, html="") {
  if (extractor === "video-only") return "video";
  const len = (text || "").split(/\s+/).length;
  if (len >= 800) return "full";
  if (len >= 300) return "partial";
  if (len > 0) return "snippet";
  return "fail";
}

function toMdList(items) {
  const dt = new Date().toISOString().split("T")[0];
  const header = `# Paywalled / Subscription Articles to Fetch\n\n_Last updated: ${dt}_\n`;
  if (!items.length) return `${header}\n_No items this run._\n`;
  const blocks = items.map(it => {
    return [
      `### ${it.source || "Unknown"} — “${it.title || "(no title)"}”`,
      `**URL:** ${it.url}`,
      `**Reason:** ${it.error ? `error: ${it.error}` : (it.fulltext_quality === "fail" ? "fetch failed" : "snippet-only")}`,
      `**Quality:** ${it.fulltext_quality}`,
      `**Suggested Action:** Open via your subscription and re-run analysis.`,
      `---`
    ].join("\n");
  });
  return `${header}\n${blocks.join("\n\n")}\n`;
}

// ---------- main ----------
(async function main() {
  ensureDir(DATA_DIR);
  console.log("[fetchText] IN_PATH:", IN_PATH);
  console.log("[fetchText] OUT_PATH:", OUT_PATH);
  console.log("[fetchText] FETCH_LATER_MD:", FETCH_LATER_MD);

  if (!fs.existsSync(IN_PATH)) {
    console.error("[fetchText] Missing input:", IN_PATH);
    console.error("Run: node src/loadWeek.js first.");
    process.exit(1);
  }

  const raw = fs.readFileSync(IN_PATH, "utf-8");
  console.log("[fetchText] week.json bytes:", raw.length);
  let items = [];
  try {
    items = JSON.parse(raw);
  } catch (e) {
    console.error("[fetchText] Failed to parse week.json:", e.message);
    process.exit(1);
  }
  console.log("[fetchText] Items to process:", items.length);

  if (!items.length) {
    fs.writeFileSync(OUT_PATH, "[]", "utf-8");
    fs.writeFileSync(FETCH_LATER_MD, toMdList([]), "utf-8");
    console.log(chalk.yellow("No items to process; wrote empty outputs."));
    process.exit(0);
  }

  console.log(chalk.cyan(`Extracting full text for ${items.length} items… (policy: ${FULLTEXT_POLICY})`));
  const limit = pLimit(CONCURRENCY);

  const processed = await Promise.all(items.map(it => limit(async () => {
    let html = "";
    let text = "";
    let by = "none";
    let error = null;

    try {
      html = await fetchHtml(it.url);
      const ext = extractMainText(html, it.url);
      text = ext.text;
      by = ext.by;
    } catch (e) {
      error = e?.message || "fetch failed";
    }

    const fulltext_quality = classifyQuality(text, by, html);
    const textPreview = text ? text.slice(0, 800) : "";
    const contentHash = hash(text || html || it.url);

    return {
      ...it,
      fulltext_quality,
      extractor: by,
      textPreview,
      contentHash,
      error: error || undefined
    };
  })));

  // Apply FULLTEXT_POLICY to produce the set for analysis
  let forAnalysis = processed;
  if (FULLTEXT_POLICY === "required") {
    forAnalysis = processed.filter(p => p.fulltext_quality === "full");
  } else if (FULLTEXT_POLICY === "preferred") {
    forAnalysis = processed.filter(p => p.fulltext_quality === "full" || p.fulltext_quality === "partial");
  } // 'off' keeps all

  // Build fetch-later list for snippet/fail
  const fetchLater = processed.filter(p => p.fulltext_quality === "snippet" || p.fulltext_quality === "fail")
    .map(p => ({ ...p, reason: p.error ? `error: ${p.error}` : "" }));

  // Persist outputs
  fs.writeFileSync(OUT_PATH, JSON.stringify(forAnalysis, null, 2), "utf-8");
  fs.writeFileSync(FETCH_LATER_MD, toMdList(fetchLater), "utf-8");

  // Summary
  const counts = processed.reduce((acc, p) => {
    acc[p.fulltext_quality] = (acc[p.fulltext_quality] || 0) + 1;
    return acc;
  }, {});

  console.log(chalk.green(`\nSaved items for analysis → ${OUT_PATH}`));
  console.log(chalk.magenta(`fetch_later.md count: ${fetchLater.length} → ${FETCH_LATER_MD}`));
  console.log(chalk.gray(`Quality breakdown: ${JSON.stringify(counts)}`));

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
