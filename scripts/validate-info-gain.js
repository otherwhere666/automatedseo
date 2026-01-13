#!/usr/bin/env node

/**
 * Validates that content has sufficient "information gain" -
 * unique value that isn't just generic AI-generated content.
 */

import fs from 'fs/promises';
import path from 'path';

const INFO_GAIN_PATTERNS = [
  { pattern: /if you['']?re .+, (choose|pick|go with|skip)/i, name: 'Decision framework' },
  { pattern: /\|.+\|.+\|/m, name: 'Comparison table' },
  { pattern: /\d{1,3}%/, name: 'Percentage/data point' },
  { pattern: /(skip|avoid|don't book|tourist trap)/i, name: 'Counter-recommendation' },
  { pattern: /\$\d+/, name: 'Specific price' },
  { pattern: /\d+ (minutes?|hours?|days?)/i, name: 'Specific time' },
  { pattern: /(we['']?re seeing|this month|trend|currently)/i, name: 'Trend observation' },
  { pattern: /common mistake|people often|many travelers/i, name: 'Common mistakes' },
  { pattern: /pro tip|insider|locals know/i, name: 'Insider tip' },
];

const MIN_REQUIRED = 2;

async function validateInfoGain(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  const found = [];
  const missing = [];

  for (const { pattern, name } of INFO_GAIN_PATTERNS) {
    if (pattern.test(content)) {
      found.push(name);
    } else {
      missing.push(name);
    }
  }

  const score = found.length;
  const pass = score >= MIN_REQUIRED;

  console.log(`\n📊 Information Gain Validation: ${path.basename(filePath)}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Score: ${score}/${INFO_GAIN_PATTERNS.length} (minimum: ${MIN_REQUIRED})`);
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}`);

  if (found.length > 0) {
    console.log(`\n✓ Found:`);
    found.forEach(f => console.log(`  • ${f}`));
  }

  if (!pass) {
    console.log(`\n✗ Missing (consider adding):`);
    missing.slice(0, 3).forEach(m => console.log(`  • ${m}`));
  }

  return { score, pass, found, missing };
}

// CLI
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: npm run validate:info-gain <file-path>');
  process.exit(1);
}

validateInfoGain(filePath).catch(console.error);
