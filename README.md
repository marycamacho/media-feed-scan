# **🤖 media-feed-scan: Automated Media Intelligence Pipeline**

**Purpose:** A fully automated, containerized Node.js pipeline that gathers media intelligence. It scans multiple feeds, extracts full text, analyzes content with OpenAI, and securely archives processed results to a shared Nextcloud folder.

**Project Status:** Production Ready. Deployed and running autonomously via Cron on a Linux server.

**Current Lookback Period:** **2 days** (configurable in `config.js`).

---

## **⚙️ Project Overview and Execution Flow**

The workflow is orchestrated by the entry script **`src/runAll.js`**, executed inside an isolated Docker container.

### **Core Execution Flow**

1. **Read Feeds**  
    Reads `radar.opml` and pulls recent articles based on the **2-day lookback**.

2. **Process & Analyze**  
    Passes data through the five core scripts:  
    `pullFromOpml.js` → `loadWeek.js` → `fetchText.js` → `analyzeBatch.js` → `scoreAndSelect.js`

3. **Data Output**  
    Outputs JSON and Markdown files to `data/`.

4. **Secure Upload**  
    All files in `data/` are uploaded to a time-stamped folder in the **Nextcloud shared drive** via WebDAV.

### **Key Configuration Files**

* **`config.js`** — Main settings: `DAYS_BACK`, concurrency, model selection, etc.

* **`radar.opml`** — List of media feeds.

* **`Dockerfile`** — Defines a clean **Node v22 LTS** environment.

---

## **🛠️ Local Development and Testing**

### **Initial Setup**

`# Clone the repository`  
`git clone https://github.com/marycamacho/media-feed-scan.git`  
`cd media-feed-scan`

`# Install dependencies`  
`npm install`

`# Local environment variables`  
`export OPENAI_API_KEY="sk-..."`  
`export NEXTCLOUD_URL="https://your.nextcloud.instance/remote.php/dav/files/automation/"`  
`export NEXTCLOUD_USER="automation"`  
`export NEXTCLOUD_PASSWORD="APP-PASSWORD"`

### **Running the Full Local Workflow**

`# Run the entire analysis + upload sequence`  
`node src/runAll.js`

### **Data Cleanup**

`# Clear all generated files`  
`bash reset.sh`

---

## **🐳 Production Deployment and Automation**

The application deploys to the Hetzner server via a Git-based Docker build.

### **Server Configuration and Secrets**

Secrets file:

`/etc/media-feed-scanner.env`

Required variables:

* `OPENAI_API_KEY`

* `NEXTCLOUD_USER`

* `NEXTCLOUD_PASSWORD`

* `NEXTCLOUD_URL`

### **Update & Deployment Process**

**On your local machine:**

`git push`

**On the Hetzner server (via SSH):**

`cd /opt/media-scan-app/media-feed-scan`  
`git pull`  
`docker build -t media-feed-scanner .`

### **Scheduled Run (Cron)**

**Every odd day at 7:00 AM**  
 Cron format: `0 7 1-31/2 * *`

`0 7 1-31/2 * * docker run --rm --env-file /etc/media-feed-scanner.env media-feed-scanner > /dev/null 2>&1`

---

## **📜 Appendix: Manual Workflow and Core Details**

### **`.gitignore` for Generated Data**

`/data/**`  
`!/data/.gitkeep`  
`.cache/**`  
`/tmp/**`  
`/logs/**`

Archive old runs by moving them into `data/archive/`.

---

## **🧪 Manual Workflow (Debug / Single-Step Runs)**

### **0\. Prerequisite: Activate Key**

`export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`

---

### **1\. Build Feed List from OPML**

`node src/pullFromOpml.js radar.opml`

**Reads:** `radar.opml`  
 **Writes:** `data/week.raw.json`  
 **Notes:** Applies `config.DAYS_BACK` and `config.TIMEZONE`.

---

### **2\. Load the Week's Working Set**

`node src/loadWeek.js`

**Reads:** `data/week.raw.json`, `data/seen_urls.json`  
 **Writes:** `data/week.json`, updates `data/seen_urls.json`  
 **Notes:** Dedupes by canonical URL; tags competitors via `config.COMPETITOR_DOMAINS`; adds topics from `src/topics.js`.

---

### **3\. Fetch Full Article Text**

`node src/fetchText.js`

**Reads:** `data/week.json`  
 **Writes:** `data/week.text.json`, `data/fetch_later.md`  
 **Notes:** Extracts readable text; sets `fulltext_quality` and honors `config.FULLTEXT_POLICY` (`required` / `preferred` / `off`).

---

### **4\. Analyze the Batch**

`node src/analyzeBatch.js`

**Reads:**

* `data/week.curated.json` (if present, preferred)

* else `data/week.text.json`

* cache at `data/.analysis.cache.json`

**Writes:**

* `data/week.analyzed.json`

* updates `data/.analysis.cache.json`

**Notes:** Uses `prompts/cirdia_system_prompt.txt` and `config.OPENAI_MODELS.ANALYZE`.

---

### **5\. Score & Select**

`node src/scoreAndSelect.js`

**Writes:**

* `data/week_full.json`

* `data/week_top10.md`

* `data/backlog_high.md`

* `data/research_queue.md`

---

### **🏃 RUN EVERYTHING AT ONCE (Legacy Method)**

`bash reset.sh && \`  
`node src/pullFromOpml.js radar.opml && \`  
`node src/loadWeek.js && \`  
`node src/fetchText.js && \`  
`node src/analyzeBatch.js && \`  
`node src/scoreAndSelect.js`

---

## **📝 Notes to Future Me**

* If a step fails, rerun just that script; everything is file-based.

* Keep all generated data out of Git.

* If you add a new step (e.g., compose/export), append it at the end of the chain above.
