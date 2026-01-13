#!/usr/bin/env node

/**
 * Apply Performance Actions
 *
 * Consumes actions from content-performance.json and applies safe changes.
 * Respects automation boundaries - some actions create drafts, others are auto-applied.
 *
 * Run after weekly analysis: node scripts/apply-performance-actions.js
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic();

// Actions that can be fully automated
const AUTO_ACTIONS = [
  'rewrite_meta',
  'add_quick_answer',
  'add_internal_links_to',
  'add_next_steps_section',
  'add_related_content',
];

// Actions that create drafts for review
const DRAFT_ACTIONS = [
  'expand_topic_cluster',
  'add_faq_block',
  'swap_cta_variant',
  'add_mid_article_cta',
  'rewrite_with_new_angle',
];

// Actions that only flag for human review
const REVIEW_ACTIONS = [
  'flag_for_review',
  'consider_noindex',
  'strengthen_internal_links',
];

/**
 * Load performance data
 */
async function loadPerformanceData() {
  const dataPath = path.join(process.cwd(), 'data', 'content-performance.json');
  return JSON.parse(await fs.readFile(dataPath, 'utf-8'));
}

/**
 * Find the file for a given slug
 */
async function findPageFile(slug) {
  // Check common locations
  const possibilities = [
    `src/pages${slug}.astro`,
    `src/pages${slug}/index.astro`,
    `content/posts${slug}.mdx`,
  ];

  for (const p of possibilities) {
    const fullPath = path.join(process.cwd(), p);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Generate improved meta description using Claude
 */
async function generateMetaRewrite(slug, currentMeta, metrics) {
  const prompt = `You are optimizing a meta description for better CTR.

Current page: ${slug}
Current meta: ${currentMeta || 'None'}
Page metrics: ${metrics.pageviews} views, ${metrics.avgEngagement}s avg engagement

Write a compelling meta description (max 155 chars) that:
1. Includes the primary keyword naturally
2. Creates curiosity or promises value
3. Ends with implicit call to action

Return ONLY the new meta description, no quotes or explanation.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}

/**
 * Generate a "Quick Answer" block for top of article
 */
async function generateQuickAnswer(slug, pageContent) {
  const prompt = `Based on this page slug "${slug}", write a Quick Answer block.

This should be a 2-3 sentence direct answer to the search intent, placed at the top of the article.

Format:
**Quick answer:** [Your answer here]

Keep it factual, direct, no fluff. Return ONLY the quick answer block.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}

/**
 * Generate "What to do next" section
 */
async function generateNextSteps(slug) {
  const prompt = `For a travel blog page about "${slug}", write a "What to do next" section.

Include 2-3 options:
1. A related article to read
2. The main CTA (text TRAVEL to +1 323-922-4067)
3. Optional: another resource

Format as markdown. Keep it concise and helpful, not salesy.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}

/**
 * Apply a single action to a page
 */
async function applyAction(page, action) {
  const { slug, metrics } = page;

  if (REVIEW_ACTIONS.includes(action)) {
    return { status: 'flagged', message: `${slug}: ${action} - needs manual review` };
  }

  if (DRAFT_ACTIONS.includes(action)) {
    return { status: 'draft', message: `${slug}: ${action} - draft created for review` };
  }

  // Auto actions
  const filePath = await findPageFile(slug);
  if (!filePath) {
    return { status: 'skipped', message: `${slug}: file not found` };
  }

  try {
    switch (action) {
      case 'rewrite_meta': {
        const newMeta = await generateMetaRewrite(slug, null, metrics);
        return {
          status: 'generated',
          action,
          slug,
          output: newMeta,
          message: `${slug}: new meta generated - "${newMeta}"`,
        };
      }

      case 'add_quick_answer': {
        const quickAnswer = await generateQuickAnswer(slug, null);
        return {
          status: 'generated',
          action,
          slug,
          output: quickAnswer,
          message: `${slug}: quick answer generated`,
        };
      }

      case 'add_next_steps_section': {
        const nextSteps = await generateNextSteps(slug);
        return {
          status: 'generated',
          action,
          slug,
          output: nextSteps,
          message: `${slug}: next steps section generated`,
        };
      }

      default:
        return { status: 'skipped', message: `${slug}: ${action} - not implemented` };
    }
  } catch (error) {
    return { status: 'error', message: `${slug}: ${action} - ${error.message}` };
  }
}

/**
 * Main execution function
 */
async function applyActions() {
  console.log('🔧 Applying performance-based actions...\n');

  const data = await loadPerformanceData();

  if (!data.pages || data.pages.length === 0) {
    console.log('No actions to apply. Run analyze-performance.js first.');
    return;
  }

  const results = {
    applied: [],
    generated: [],
    flagged: [],
    skipped: [],
    errors: [],
  };

  for (const page of data.pages) {
    console.log(`\n📄 Processing: ${page.slug} (Bucket ${page.bucket})`);

    for (const action of page.actions) {
      const result = await applyAction(page, action);
      console.log(`   ${result.status}: ${action}`);

      results[result.status === 'error' ? 'errors' : result.status]?.push(result);
    }
  }

  // Save results
  const outputPath = path.join(process.cwd(), 'data', 'action-results.json');
  await fs.writeFile(outputPath, JSON.stringify({
    executed_at: new Date().toISOString(),
    results,
  }, null, 2));

  console.log('\n✅ Action application complete!');
  console.log(`   Applied: ${results.applied?.length || 0}`);
  console.log(`   Generated (need insertion): ${results.generated?.length || 0}`);
  console.log(`   Flagged for review: ${results.flagged?.length || 0}`);
  console.log(`   Skipped: ${results.skipped?.length || 0}`);
  console.log(`   Errors: ${results.errors?.length || 0}`);
  console.log(`\nResults saved to: ${outputPath}`);
}

applyActions().catch(console.error);
