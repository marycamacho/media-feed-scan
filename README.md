# media-feed-scan

A small Node.js CLI that scans configured media/news feeds, normalizes results, and writes them to `data/` for downstream analysis or export.

> Repo: https://github.com/marycamacho/media-feed-scan

---

## Quickstart

```bash
# 1) Clone & enter
git clone https://github.com/marycamacho/media-feed-scan.git
cd media-feed-scan

# 2) Install deps
npm install

# 3) See available commands
node index.js --help

# 4) Run a full scan
node index.js scan --all
