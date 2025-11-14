# media-feed-scan — personal README

> **Purpose:** Notes for *me* so I remember exactly what this thing does and the few commands I actually run. Keep this short and practical.

---

## What it does

Scans feeds I care about, fetches the articles, extracts readable text, and writes results into `data/` for later editing/exporting. OPML (`radar.opml`) is the source of truth for feeds.

---

## Install (once)

```bash
# Clone & enter
git clone https://github.com/marycamacho/media-feed-scan.git
cd media-feed-scan

# Node deps
npm install
npm install axios

# Optional: create a place for outputs
mkdir -p data/{feeds,html,text,normalized,export,archive}
```

**Config:** Edit `config.js` if needed (timeouts, concurrency, folders).

---

## Data & .gitignore

Generated output should **not** be in git. I keep these ignored:

```bash
/data/**
!/data/.gitkeep   # if I want empty dirs tracked
.cache/**
/tmp/**
/logs/**
```

If I want to save old runs, I move them into `data/archive/` (also ignored).

---

## Reset from scratch

```bash
# hard reset everything this app generated
bash reset.sh
# (reset.sh should rm ./data/* except ./data/archive, plus any .cache folders)
```

---

## Manual workflow (what I actually run)

Run each step directly with Node — **in this order**. After each command I’ve listed exact **Reads** and **Writes** so I know what files to expect.

PREREQUISITE: Activate key

````bash
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
````

1. **Build feed list from OPML**

```bash
node src/pullFromOpml.js radar.opml
```

* **Reads:** `radar.opml`
* **Writes:** `data/week.raw.json`
* **Notes:** Uses `config.DAYS_BACK` and `config.TIMEZONE` to keep recent items only.

2. **Load the week's working set**

```bash
node src/loadWeek.js
```

* **Reads:** `data/week.raw.json`, `data/seen_urls.json` *(if exists)*
* **Writes:** `data/week.json`, updates `data/seen_urls.json`
* **Notes:** Dedupes by canonical URL; tags competitors via `config.COMPETITOR_DOMAINS`; adds topic hits from `src/topics.js`.

3. **Fetch full article text**

```bash
node src/fetchText.js
```

* **Reads:** `data/week.json`
* **Writes:** `data/week.text.json`, `data/fetch_later.md`
* **Notes:** Extracts readable text; sets `fulltext_quality` and honors `config.FULLTEXT_POLICY` (`required`/`preferred`/`off`).

4. **Analyze the batch**

```bash
node src/analyzeBatch.js
```

* **Reads:** `data/week.curated.json` *(if present, preferred)* **else** `data/week.text.json`; cache at `data/.analysis.cache.json`
* **Writes:** `data/week.analyzed.json`, updates `data/.analysis.cache.json`
* **Notes:** Uses `prompts/cirdia_system_prompt.txt` and `config.OPENAI_MODELS.ANALYZE`.

5. **Score & select

```bash
node src/scoreAndSelect.js
```
* **Writes:** `data/week_full.json`, `data/week_top10.md`, `data/backlog_high.md`, `data/research_queue.md`


## RUN ALL AT ONCE 

```bash
bash reset.sh && \
node src/pullFromOpml.js radar.opml && \
node src/loadWeek.js && \
node src/fetchText.js && \
node src/analyzeBatch.js && \
node src/scoreAndSelect.js
```

## Notes to future me

* If a step fails, re-run just that script; everything is file-based.
* Keep **all** generated data out of git.
* If I add a step (e.g., compose/export), append it at the end of the chain above.
