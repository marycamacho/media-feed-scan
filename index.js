#!/usr/bin/env node
import fs from "fs";
import Parser from "rss-parser";
import fetch from "node-fetch";
import dayjs from "dayjs";
import chalk from "chalk";
import { XMLParser } from "fast-xml-parser";

const DAYS_BACK = 7;
const KEYWORDS = [
  "wellness","wearable","privacy","longevity","women","UX",
  "mission","public benefit","ownership","policy"
];

const parser = new Parser({ timeout: 8000 });

// --- Extract RSS URLs from OPML ---
function extractFeedsFromOPML(path) {
  const xml = fs.readFileSync(path, "utf-8");
  const fxp = new XMLParser({ ignoreAttributes: false });
  const data = fxp.parse(xml);
  const outlines = JSON.stringify(data).match(/xmlUrl":"(.*?)"/g) || [];
  return outlines.map(m => m.split('"')[2]);
}

// --- Helpers ---
function isRecent(pubDate) {
  const published = dayjs(pubDate);
  return published.isValid() && dayjs().diff(published, "day") <= DAYS_BACK;
}

function isRelevant(text) {
  return KEYWORDS.some(k => new RegExp(k, "i").test(text));
}

// --- Main run ---
async function run(opmlPath) {
  const feeds = extractFeedsFromOPML(opmlPath);
  console.log(chalk.cyan(`Found ${feeds.length} feeds in OPML`));

  const results = [];

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      const recent = feed.items.filter(i => isRecent(i.pubDate));
      const relevant = recent.filter(i =>
        isRelevant((i.title || "") + (i.contentSnippet || ""))
      );
      relevant.forEach(i =>
        results.push({
          source: feed.title || url,
          title: i.title,
          link: i.link,
          pubDate: i.pubDate,
          summary: i.contentSnippet?.slice(0, 250) || ""
        })
      );
      console.log(chalk.green(`✓ ${feed.title || url} — ${relevant.length} relevant`));
    } catch (err) {
      console.log(chalk.red(`✗ ${url} — ${err.message}`));
    }
  }

  const outputPath = `cirdia_weekly_report_${dayjs().format("YYYY-MM-DD")}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(chalk.yellow(`\nSaved ${results.length} items → ${outputPath}`));
}

if (process.argv.length < 3) {
  console.log("Usage: node index.js <path-to-opml>");
  process.exit(1);
}

run(process.argv[2]);