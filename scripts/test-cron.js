/**
 * Test script for running cron jobs on demand
 * This allows testing cron jobs without waiting for scheduled execution
 * 
 * Usage: 
 *   DEV_SECRET=your_secret node scripts/test-cron.js /api/cron/fetch-tweets
 */

require('dotenv').config();

const https = require('https');
const http = require('http');

const cronPath = process.argv[2] || '/api/cron/fetch-tweets';
const devSecret = process.env.DEV_SECRET || process.env.CRON_SECRET;
const appUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

if (!devSecret) {
  console.error('Error: DEV_SECRET or CRON_SECRET environment variable is required');
  process.exit(1);
}

// Parse the URL to determine the protocol
const url = new URL(`${appUrl}/api/dev/test-cron?path=${encodeURIComponent(cronPath)}`);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

// Run the test
console.log(`Testing cron job: ${cronPath}`);
console.log(`Request URL: ${url.toString()}`);

const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${devSecret}`,
    'Content-Type': 'application/json'
  }
};

const req = httpModule.request(url, options, (res) => {
  let data = '';
  
  console.log(`Status Code: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('Response:');
      console.log(JSON.stringify(result, null, 2));
      
      if (res.statusCode >= 400) {
        console.error('Error running cron job');
        process.exit(1);
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.error('Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Error making request:', error.message);
  process.exit(1);
});

req.end(); 