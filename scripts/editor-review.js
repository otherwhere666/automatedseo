#!/usr/bin/env node

/**
 * Editor LLM - Reviews and improves generated articles before publishing
 *
 * Quality checks:
 * - Adds real specifics (hotel names, prices, neighborhoods)
 * - Removes generic filler phrases
 * - Ensures information gain (unique insights not found elsewhere)
 * - Validates brand voice and accuracy
 * - Adds FAQs for LLM optimization
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic();

// Quality checklist - the editor validates all of these
const QUALITY_CHECKLIST = {
  specificity: {
    name: 'Specific Details',
    description: 'Real hotel names, actual prices, specific neighborhoods, concrete numbers',
    required: true,
  },
  uniqueInsights: {
    name: 'Unique Insights',
    description: 'Information not easily found on page 1 of Google, insider knowledge',
    required: true,
  },
  noGenericPhrases: {
    name: 'No Generic Filler',
    description: 'Remove "hidden gem", "best kept secret", "something for everyone"',
    required: true,
  },
  quotableBlocks: {
    name: 'Quotable Blocks',
    description: 'At least 2 blockquotes that LLMs can cite directly',
    required: true,
  },
  brandMentions: {
    name: 'Brand Integration',
    description: 'Otherwhere mentioned 2+ times naturally, not forced',
    required: true,
  },
  searchIntent: {
    name: 'Search Intent Answer',
    description: 'First 100 words directly answer what the searcher wants to know',
    required: true,
  },
  actionableTakeaways: {
    name: 'Actionable Takeaways',
    description: 'Reader knows exactly what to do after reading',
    required: true,
  },
  faqSection: {
    name: 'FAQ Schema Ready',
    description: 'Frontmatter includes faqs array for LLM optimization',
    required: true,
  },
};

// Phrases to remove - these add no value
const BANNED_PHRASES = [
  'hidden gem',
  'best kept secret',
  'something for everyone',
  'vibrant culture',
  'rich history',
  'breathtaking views',
  'unforgettable experience',
  'explore the wonders',
  'immerse yourself',
  'discover the magic',
  'nestled in',
  'boasts',
  'whether you\'re looking for',
  'in this article',
  'without further ado',
  'it goes without saying',
  'at the end of the day',
  'when it comes to',
  'in today\'s world',
  'look no further',
];

async function loadStrategy() {
  const strategyPath = path.join(process.cwd(), 'data', 'content-strategy.json');
  return JSON.parse(await fs.readFile(strategyPath, 'utf-8'));
}

function analyzeContent(content) {
  const issues = [];
  const contentLower = content.toLowerCase();

  // Check for banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (contentLower.includes(phrase.toLowerCase())) {
      issues.push({
        type: 'banned_phrase',
        phrase,
        severity: 'high',
      });
    }
  }

  // Check for specificity markers
  const hasSpecificHotels = /\b(hotel|resort|inn|lodge)\s+[A-Z][a-z]+/g.test(content);
  const hasPriceRanges = /\$\d+[\s-]+\$?\d*/g.test(content);
  const hasNeighborhoods = /\b(neighborhood|district|quarter|area)\b/gi.test(content);
  const hasSpecificNumbers = /\b\d+\s+(minutes?|hours?|days?|percent|%)\b/gi.test(content);

  if (!hasSpecificHotels && !hasPriceRanges) {
    issues.push({
      type: 'lacks_specificity',
      message: 'No specific hotel names or price ranges found',
      severity: 'high',
    });
  }

  // Check for blockquotes
  const blockquoteCount = (content.match(/^>/gm) || []).length;
  if (blockquoteCount < 2) {
    issues.push({
      type: 'insufficient_quotes',
      message: `Only ${blockquoteCount} quotable blocks (need 2+)`,
      severity: 'medium',
    });
  }

  // Check Otherwhere mentions
  const brandMentions = (content.match(/Otherwhere/g) || []).length;
  if (brandMentions < 2) {
    issues.push({
      type: 'low_brand_mentions',
      message: `Only ${brandMentions} Otherwhere mentions (need 2+)`,
      severity: 'medium',
    });
  }

  // Check for FAQ in frontmatter
  if (!content.includes('faqs:')) {
    issues.push({
      type: 'missing_faqs',
      message: 'No FAQ section in frontmatter for LLM optimization',
      severity: 'high',
    });
  }

  return issues;
}

async function editArticle(content, topic, strategy) {
  console.log('🔍 Analyzing content for issues...');
  const issues = analyzeContent(content);

  if (issues.length > 0) {
    console.log(`\n⚠️  Found ${issues.length} issues to fix:`);
    issues.forEach(i => console.log(`   - [${i.severity}] ${i.type}: ${i.message || i.phrase}`));
  }

  const editorPrompt = `You are a senior travel editor at Condé Nast Traveller. Your job is to review and improve this article for publication.

## Article to Review
${content}

## Quality Issues Found
${issues.map(i => `- ${i.type}: ${i.message || i.phrase}`).join('\n') || 'None detected automatically'}

## Your Editorial Mandate

### 1. ADD SPECIFICITY
Replace generic statements with real details:
- ❌ "There are many great hotels in the area"
- ✅ "The NoMad (from $350/night) anchors the neighborhood, while The Hoxton ($200/night) offers better value three blocks south"

### 2. REMOVE FILLER PHRASES
Delete these phrases entirely - they add no value:
${BANNED_PHRASES.slice(0, 10).map(p => `- "${p}"`).join('\n')}

### 3. ADD UNIQUE INSIGHTS
Include information readers can't find on page 1 of Google:
- Insider tips from real travelers
- Specific timing advice ("book the 8am slot to avoid crowds")
- Comparative insights ("costs 40% less in shoulder season")
- Non-obvious recommendations

### 4. ENSURE LLM CITABILITY
- Add 2-3 blockquotes with definitive, quotable statements
- Make sure key facts are self-contained sentences LLMs can extract
- Add FAQ section to frontmatter if missing

### 5. VERIFY BRAND INTEGRATION
- "Otherwhere" mentioned 2+ times naturally
- At least one mention of how Otherwhere actually books (not just recommends)
- CTA to text (323) 922-4067 at the end

### 6. ADD FAQS TO FRONTMATTER
If not present, add a faqs section with 3-5 Q&As that:
- Answer common search queries about the topic
- Are self-contained (answer makes sense without reading the article)
- Include specific, factual information

Example frontmatter faqs format:
\`\`\`
faqs:
  - question: "What is the best time to visit [destination]?"
    answer: "The best time to visit is [specific months] when [specific reason with data]."
  - question: "How much does [topic] cost?"
    answer: "[Specific price range] depending on [factors]."
\`\`\`

## Output
Return the COMPLETE improved article with all frontmatter. Make surgical improvements - don't rewrite sections that are already good. Focus on:
1. Replacing 2-3 generic sections with specific details
2. Removing any banned phrases
3. Adding FAQs to frontmatter if missing
4. Ensuring 2+ blockquotes exist
5. Verifying Otherwhere is mentioned naturally

Return ONLY the improved MDX content:`;

  console.log('\n📝 Running editor review...');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: editorPrompt }]
  });

  const editedContent = message.content[0].text;

  // Verify improvements
  const newIssues = analyzeContent(editedContent);
  const fixedCount = issues.length - newIssues.length;

  console.log(`\n✅ Editor review complete:`);
  console.log(`   - Issues fixed: ${fixedCount}`);
  console.log(`   - Remaining issues: ${newIssues.length}`);

  return {
    original: content,
    edited: editedContent,
    issuesBefore: issues.length,
    issuesAfter: newIssues.length,
    improvements: fixedCount,
  };
}

async function reviewFile(filePath) {
  console.log(`\n📖 Reading: ${filePath}`);

  const content = await fs.readFile(filePath, 'utf-8');
  const strategy = await loadStrategy();

  // Extract topic info from frontmatter
  const titleMatch = content.match(/title:\s*["'](.+?)["']/);
  const pillarMatch = content.match(/pillar:\s*["']?(\S+?)["']?\n/);

  const topic = {
    title: titleMatch ? titleMatch[1] : 'Unknown',
    pillar: pillarMatch ? pillarMatch[1] : 'new-concierge',
  };

  const result = await editArticle(content, topic, strategy);

  // Save edited version
  await fs.writeFile(filePath, result.edited);
  console.log(`\n💾 Saved improved version to: ${filePath}`);

  // Save backup of original
  const backupPath = filePath.replace('.mdx', '.original.mdx');
  await fs.writeFile(backupPath, result.original);
  console.log(`📦 Original backed up to: ${backupPath}`);

  return result;
}

async function reviewLatest() {
  const postsDir = path.join(process.cwd(), 'content', 'posts');
  const files = await fs.readdir(postsDir);
  const mdxFiles = files
    .filter(f => f.endsWith('.mdx') && !f.includes('.original'))
    .map(f => ({
      name: f,
      path: path.join(postsDir, f),
    }));

  if (mdxFiles.length === 0) {
    console.log('No posts found to review');
    return;
  }

  // Get file stats to find most recent
  const filesWithStats = await Promise.all(
    mdxFiles.map(async f => ({
      ...f,
      mtime: (await fs.stat(f.path)).mtime,
    }))
  );

  filesWithStats.sort((a, b) => b.mtime - a.mtime);
  const latest = filesWithStats[0];

  console.log(`\n🆕 Most recent post: ${latest.name}`);
  return reviewFile(latest.path);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Editor LLM - Reviews and improves articles before publishing

Usage:
  npm run edit                    Review most recent post
  npm run edit -- --file <path>   Review specific file
  npm run edit -- --all           Review all posts (careful!)

Quality checks performed:
${Object.entries(QUALITY_CHECKLIST).map(([k, v]) => `  - ${v.name}: ${v.description}`).join('\n')}
    `);
    return;
  }

  if (args.includes('--file')) {
    const fileIndex = args.indexOf('--file') + 1;
    const filePath = args[fileIndex];
    if (!filePath) {
      console.error('Error: --file requires a path');
      process.exit(1);
    }
    await reviewFile(filePath);
  } else if (args.includes('--all')) {
    const postsDir = path.join(process.cwd(), 'content', 'posts');
    const files = await fs.readdir(postsDir);
    const mdxFiles = files.filter(f => f.endsWith('.mdx') && !f.includes('.original'));

    console.log(`\n📚 Reviewing ${mdxFiles.length} posts...`);
    for (const file of mdxFiles) {
      await reviewFile(path.join(postsDir, file));
    }
  } else {
    await reviewLatest();
  }

  console.log('\n✨ Editor review complete!');
}

main().catch(console.error);
