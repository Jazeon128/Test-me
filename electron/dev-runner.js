/**
 * Development Runner
 * Helper script to ensure frontend dev server is running before starting Electron
 */

const { spawn } = require('child_process');
const http = require('http');

const FRONTEND_URL = 'http://localhost:5173';
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000;

function checkFrontendServer(retries = 0) {
  return new Promise((resolve, reject) => {
    http.get(FRONTEND_URL, (res) => {
      if (res.statusCode === 200) {
        console.log('✓ Frontend dev server is running');
        resolve();
      } else {
        reject(new Error(`Frontend server returned status ${res.statusCode}`));
      }
    }).on('error', (err) => {
      if (retries < MAX_RETRIES) {
        console.log(`Waiting for frontend dev server... (${retries + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          checkFrontendServer(retries + 1).then(resolve).catch(reject);
        }, RETRY_INTERVAL);
      } else {
        reject(new Error('Frontend dev server not available. Please start it with: cd ../frontend && npm run dev'));
      }
    });
  });
}

async function startElectron() {
  try {
    await checkFrontendServer();
    
    console.log('Starting Electron...\n');
    
    const electron = spawn('electron', ['.'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });

    electron.on('close', (code) => {
      console.log(`\nElectron exited with code ${code}`);
      process.exit(code);
    });
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nMake sure the frontend dev server is running:');
    console.error('  cd ../frontend');
    console.error('  npm run dev');
    process.exit(1);
  }
}

startElectron();
