// src/testUpload.js (Final Version using correct NEXTCLOUD_PASSWORD)
import { createClient } from 'webdav';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Path Configuration Fix ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..'); // Points to the project root

// --- Configuration ---
const NC_URL = process.env.NEXTCLOUD_URL;
const NC_USER = process.env.NEXTCLOUD_USER;
// CRITICAL FIX: Match the environment variable name exactly.
const NC_PASS = process.env.NEXTCLOUD_PASSWORD; 

const LOCAL_DATA_DIR = path.join(PROJECT_ROOT, 'data');
const NC_REMOTE_BASE_PATH = '/Growth-Automations/feed-articles-for-posts/'; 

const RUN_DATE_TIME = new Date().toISOString().replace(/:/g, '-').slice(0, 19); 
const NC_REMOTE_RUN_PATH = NC_REMOTE_BASE_PATH + RUN_DATE_TIME + '/';


async function testUpload() {
    // Check using the exact variable names the script is reading:
    if (!NC_URL || !NC_USER || !NC_PASS) {
        console.error('❌ ERROR: Nextcloud credentials are NOT set correctly in the environment.');
        console.error('Please verify you have run export commands for:');
        console.error('  - NEXTCLOUD_URL');
        console.error('  - NEXTCLOUD_USER');
        console.error('  - NEXTCLOUD_PASSWORD');
        return;
    }

    console.log(`\n⬆️ Attempting upload to: ${NC_URL} at path: ${NC_REMOTE_RUN_PATH}`);
    
    const client = createClient(
        NC_URL, 
        { username: NC_USER, password: NC_PASS }
    );
    
    try {
        await client.createDirectory(NC_REMOTE_RUN_PATH, { recursive: true });
        console.log(`- Created remote directory: ${NC_REMOTE_RUN_PATH}`);

        // Read all files from the local 'data/' folder
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
        
        console.log('\n✅ Nextcloud Upload Test SUCCESSFUL! Check your Nextcloud instance.');

    } catch (error) {
        console.error(`\n❌ CRITICAL UPLOAD FAILURE. Check URL, Pass, and Permissions.`);
        console.error('Error details:', error.message);
    }
}

testUpload();