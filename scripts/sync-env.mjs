#!/usr/bin/env node
// Pulls all env vars from Netlify and writes them to .env
// Usage: npm run sync-env

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const json = execSync('npx netlify env:list --json', { encoding: 'utf8' });
const vars = JSON.parse(json);

const lines = Object.entries(vars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

writeFileSync('.env', lines + '\n');
console.log(`✓ Wrote ${Object.keys(vars).length} vars to .env`);
