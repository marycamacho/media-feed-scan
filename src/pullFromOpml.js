#!/usr/bin/env node
import fs from "fs";
import path from "path";
import Parser from "rss-parser";
import dayjs from "dayjs";
import chalk from "chalk";
import { XMLParser } from "fast-xml-parser";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
import config from "../config.js";
import { fileURLToPath } from "url";

dayjs.extend(utc); dayjs.extend(tz);
const TIMEZONE = config.TIMEZONE || "Europe/Madrid";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- config / args ----------
const OPML_FROM_ARGS = process.argv[2]; // allow override: node src/pullFromOpml.js /abs/path/to/radar.opml
const OPML_PATH = OPML_FROM_ARGS
  ? path.resolve(process.cwd(), OPML_FROM_ARGS)
  : config.OPML_PATH; // e.g., path.join(projectRoot, "radar.opml")

const DATA_DIR = config.DATA_DIR;
const DAYS_BACK = config.DAYS_BACK || 7;

const parser = new Parser({ timeout: 15000 });

// ---------- helpers ----------
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function extractFeedsFromOPML(p) {
  const xml = fs.readFileSync(p, "utf-8");
  const fxp = new XMLParser({ ignoreAttributes: false });
  const data = fxp.parse(xml);
  const outlines = JSON.stringify(data).match(/xmlUrl":"(.*?)"/g) || [];
  const urls = outlines.map(m => m.split('"')[2]).filter(Boolean);
  return Array.from(new Set(urls));
}

function isRecent(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.date;
  const d = dayjs(raw);
  if (!d.isValid()) return false;
  const cutoff = dayjs().tz(TIMEZONE).subtract(DAYS_BACK, "day");
  return d.isAfter(cutoff);
}

function isRelevant(text) {
  // keep generous at pull stage; we’ll do deep relevance later
  return true;
}

function cleanUrl(u) {
  try {
    const url = new URL(u);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_id","gclid","fbclid","mc_cid","mc_eid","igshid","ref"].forEach(k=>url.searchParams.delete(k));
    return url.toString();
  } catch { return u; }
}

// ---------- main ----------
(async function main() {
  // sanity checks
  if (!fs.existsSync(OPML_PATH)) {
    console.error(chalk.red(`OPML file not found at: ${OPML_PATH}`));
    console.error(chalk.yellow(`Tip: run with an explicit path: node src/pullFromOpml.js /full/path/to/radar.opml`));
    process.exit(1);
  }
  const size = fs.statSync(OPML_PATH).size;
  console.log(chalk.gray(`Reading OPML from: ${OPML_PATH} (${size} bytes)`));

  const feeds = extractFeedsFromOPML(OPML_PATH);
  console.log(chalk.cyan(`Found ${feeds.length} feeds`));
  if (feeds.length === 0) {
    console.error(chalk.red("Parsed OPML but found 0 feeds (no xmlUrl attributes)."));
    process.exit(1);
  }

  const results = [];
  const seen = new Set();

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      const recent = (feed.items || []).filter(isRecent);
      const kept = recent.filter(i => isRelevant(`${i.title||""} ${i.contentSnippet||""}`));

      kept.forEach(i => {
        const link = cleanUrl(i.link || "");
        if (!link || seen.has(link)) return;
        seen.add(link);
        results.push({
          source: feed.title || url,
          title: i.title || "",
          url: link,
          published: i.isoDate || i.pubDate || i.published || "",
          summary: (i.contentSnippet || i.summary || "").slice(0, 400),
          feed_url: url
        });
      });

      console.log(chalk.green(`✓ ${feed.title || url} — kept ${kept.length}`));
    } catch (err) {
      console.log(chalk.red(`✗ ${url} — ${err?.message || "fetch failed"}`));
    }
  }

  ensureDir(DATA_DIR);
  const out = path.join(DATA_DIR, "week.raw.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2), "utf-8");
  console.log(chalk.yellow(`\nSaved ${results.length} items → ${out}`));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
