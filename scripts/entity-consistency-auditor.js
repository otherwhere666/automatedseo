#!/usr/bin/env node

/**
 * Validates entity consistency - ensures brand name, category,
 * and contact info are used correctly throughout content.
 */

import fs from 'fs/promises';
import path from 'path';

const ENTITY_RULES = [
  {
    name: 'Brand name "Otherwhere"',
    check: (content) => /Otherwhere/.test(content),
    required: true,
  },
  {
    name: 'No brand misspellings',
    check: (content) => !/Other Where|OtherWhere|Other-where|other where/i.test(content),
    required: true,
  },
  {
    name: 'Category phrase "AI travel concierge"',
    check: (content) => /AI travel concierge/i.test(content),
    required: true,
  },
  {
    name: 'Phone number present',
    check: (content) => /\+1\s*\(323\)\s*922-4067|\+13239224067|323[- .]922[- .]4067/.test(content),
    required: false, // Not all content needs phone
  },
  {
    name: 'Link to canonical explainer',
    check: (content) => /\/what-is-otherwhere|\/about/.test(content),
    required: false,
  },
  {
    name: 'Trigger word "TRAVEL"',
    check: (content) => /text TRAVEL|Text TRAVEL/i.test(content),
    required: false,
  },
];

async function auditEntityConsistency(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  const results = [];
  let hasErrors = false;

  for (const rule of ENTITY_RULES) {
    const pass = rule.check(content);
    results.push({ ...rule, pass });

    if (rule.required && !pass) {
      hasErrors = true;
    }
  }

  console.log(`\n🔍 Entity Consistency Audit: ${path.basename(filePath)}`);
  console.log(`${'─'.repeat(50)}`);

  const required = results.filter(r => r.required);
  const optional = results.filter(r => !r.required);

  console.log('\nRequired:');
  required.forEach(r => {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
  });

  console.log('\nRecommended:');
  optional.forEach(r => {
    console.log(`  ${r.pass ? '✅' : '○'} ${r.name}`);
  });

  console.log(`\nStatus: ${hasErrors ? '❌ FAIL' : '✅ PASS'}`);

  if (hasErrors) {
    process.exit(1);
  }

  return { results, hasErrors };
}

// CLI
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: npm run validate:entity <file-path>');
  process.exit(1);
}

auditEntityConsistency(filePath).catch(console.error);
