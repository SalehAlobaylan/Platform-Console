#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
    }
}

if (process.env.WAHB_MANAGED_ENV !== '1') {
    loadEnvFile(path.join(__dirname, '..', '.env.local'));
    loadEnvFile(path.join(__dirname, '..', '.env'));
}

const cmsBaseUrl = process.env.CMS_BASE_URL || '(unset)';
const iamBaseUrl = process.env.IAM_BASE_URL || '(unset)';
const aggregationBaseUrl = process.env.AGGREGATION_BASE_URL || '(unset)';

console.log('[Platform-Console] Service connection config');
console.log('- Auth: server-side proxy + httpOnly cookies (IAM)');
console.log('- Database: none (frontend-only app)');
console.log(`- IAM service:         ${iamBaseUrl}`);
console.log(`- CMS service:         ${cmsBaseUrl}`);
console.log(`- Aggregation service: ${aggregationBaseUrl}`);
