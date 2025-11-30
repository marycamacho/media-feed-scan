// src/runAll.js (Final Version for Server Deployment)
import { execSync } from 'child_process';
import { createClient } from 'webdav';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// --- Path Configuration Fix (Required in ES Modules) ---
// This safely determines the project root, regardless of where the script is run from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..'); // Points to the media-feed-scan/ directory

// --- Configuration (Credentials via Environment Variables) ---
const NC_URL = process.env.NEXTCLOUD_URL;
const NC_USER = process.env.NEXTCLOUD_USER;
// FIX: Use the environment variable name confirmed by the user
const NC_PASS = process.env.NEXTCLOUD_PASSWORD; 

const INPUT_OPML = 'radar.opml';
const LOCAL_DATA_DIR = path.join(PROJECT_ROOT, 'data'); 

// CORRECTED BASE PATH: Relative path to the target folder within the user's files
const NC_REMOTE_BASE_PATH = '/Growth/Growth-Automations/feed-articles-for-posts/'; 

// Generate a unique, dated folder path (e.g., /.../2025-11-29T20-44-01/)
const RUN_DATE_TIME = new Date().toISOString().replace(/:/g, '-').slice(0, 19); 
const NC_REMOTE_RUN_PATH = NC_REMOTE_BASE_PATH + RUN_DATE_TIME + '/';


// --- Core Workflow Execution ---
function runScript(script, args) {
  console.log(`\n▶️ Running: ${script} ${args}`);
  // We use the full, resolved path to the script to ensure Node.js finds it
  const scriptPath = path.join(PROJECT_ROOT, script);

  // Executes your existing, well-tested scripts
  execSync(`node ${scriptPath} ${args}`, { stdio: 'inherit' });
}


// --- Nextcloud Upload Logic (Uploads ALL files from 'data/') ---
async function uploadAllData() {
  if (!NC_URL || !NC_USER || !NC_PASS) {
    console.error('❌ ERROR: Nextcloud credentials not found. Check server environment variables.');
    return;
  }
  console.log(`\n⬆️ Starting Nextcloud Upload to: ${NC_REMOTE_RUN_PATH}`);
  
  const client = createClient(
    NC_URL, 
    { username: NC_USER, password: NC_PASS }
  );
  
  try {
    // This creates the new dated subfolder inside the target base path
    await client.createDirectory(NC_REMOTE_RUN_PATH, { recursive: true });
    
    const localFiles = fs.readdirSync(LOCAL_DATA_DIR);
    
    for (const fileName of localFiles) {
        const localFilePath = path.join(LOCAL_DATA_DIR, fileName);
        if (fileName.startsWith('.') || fs.statSync(localFilePath).isDirectory()) {
            continue; 
        }
        
        const remoteFilePath = NC_REMOTE_RUN_PATH + fileName;
        
        await client.putFileContents(remoteFilePath, fs.readFileSync(localFilePath));
        console.log(`- Uploaded: ${fileName}`);
    }
    
    console.log('✅ Nextcloud Upload Complete. All files saved.');

  } catch (error) {
    console.error(`\n❌ Failed during Nextcloud upload. Error details:`, error.message);
  }
}

// --- Main Execution ---
async function main() {
  try {
    console.log(`--- Starting Media Feed Scan Workflow (Lookback: 2 days) ---`);
    
    // 1. Execute the full sequence of existing scripts
    runScript('src/pullFromOpml.js', INPUT_OPML);
    runScript('src/loadWeek.js', '');
    runScript('src/fetchText.js', '');
    runScript('src/analyzeBatch.js', '');
    runScript('src/scoreAndSelect.js', '');

    // 2. Upload ALL generated files to Nextcloud
    await uploadAllData();
    
    console.log('\n*** Local workflow completed successfully. ***');

  } catch (err) {
    console.error('\n❌ CRITICAL WORKFLOW FAILURE:', err.message);
    process.exit(1);
  }
}

main();