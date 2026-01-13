#!/usr/bin/env node

/**
 * GA4 Content Performance Analyzer
 *
 * Pulls GA4 metrics, classifies pages into buckets, and queues actions.
 * GA4 is an editor, not an author - it informs decisions, doesn't write content.
 *
 * Run weekly via GitHub Action or manually: node scripts/analyze-performance.js
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import fs from 'fs/promises';
import path from 'path';

// GA4 Property ID - set in environment
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;

// Initialize GA4 client (uses GOOGLE_APPLICATION_CREDENTIALS env var)
const analyticsDataClient = new BetaAnalyticsDataClient();

// Thresholds for classification
const THRESHOLDS = {
  highImpressions: 100,      // impressions in 28 days
  strongEngagement: 60,      // seconds avg engagement
  lowCTR: 0.02,              // 2% click-through rate
  highEntrances: 50,         // entrances in 28 days
  highExitRate: 0.7,         // 70% exit rate
  lowImpressions: 10,        // dead weight threshold
};

/**
 * Fetch GA4 metrics for all pages (last 28 days)
 */
async function fetchGA4Metrics() {
  if (!GA4_PROPERTY_ID) {
    console.log('⚠️  GA4_PROPERTY_ID not set - using mock data for testing');
    return getMockData();
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'entrances' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'exits' },
      ],
    });

    const metrics = {};
    for (const row of response.rows || []) {
      const pagePath = row.dimensionValues[0].value;
      metrics[pagePath] = {
        pageviews: parseInt(row.metricValues[0].value) || 0,
        entrances: parseInt(row.metricValues[1].value) || 0,
        avgEngagement: parseFloat(row.metricValues[2].value) || 0,
        bounceRate: parseFloat(row.metricValues[3].value) || 0,
        exits: parseInt(row.metricValues[4].value) || 0,
      };
    }

    // Fetch CTA events separately
    const [eventResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['sms_click', 'sms_copy', 'gpt_click', 'outbound_link'],
          },
        },
      },
    });

    for (const row of eventResponse.rows || []) {
      const pagePath = row.dimensionValues[0].value;
      const eventName = row.dimensionValues[1].value;
      const count = parseInt(row.metricValues[0].value) || 0;

      if (metrics[pagePath]) {
        metrics[pagePath].events = metrics[pagePath].events || {};
        metrics[pagePath].events[eventName] = count;
      }
    }

    return metrics;
  } catch (error) {
    console.error('Error fetching GA4 data:', error.message);
    return getMockData();
  }
}

/**
 * Mock data for testing without GA4 connection
 */
function getMockData() {
  return {
    '/what-is-otherwhere': {
      pageviews: 250,
      entrances: 180,
      avgEngagement: 95,
      bounceRate: 0.35,
      exits: 80,
      events: { sms_click: 12, gpt_click: 8 },
    },
    '/otherwhere-vs-chatgpt': {
      pageviews: 180,
      entrances: 150,
      avgEngagement: 72,
      bounceRate: 0.45,
      exits: 100,
      events: { sms_click: 3 },
    },
    '/what-is-ai-travel-concierge': {
      pageviews: 120,
      entrances: 90,
      avgEngagement: 85,
      bounceRate: 0.5,
      exits: 70,
      events: {},
    },
    '/case-studies/honeymoon-puglia': {
      pageviews: 80,
      entrances: 60,
      avgEngagement: 110,
      bounceRate: 0.3,
      exits: 25,
      events: { sms_click: 5 },
    },
    '/destinations/lisbon': {
      pageviews: 45,
      entrances: 35,
      avgEngagement: 40,
      bounceRate: 0.65,
      exits: 30,
      events: {},
    },
  };
}

/**
 * Get content role from page metadata
 */
async function getContentRoles() {
  const rolesPath = path.join(process.cwd(), 'data', 'content-roles.json');
  try {
    return JSON.parse(await fs.readFile(rolesPath, 'utf-8'));
  } catch {
    // Default roles if file doesn't exist
    return {
      '/what-is-otherwhere': 'trust',
      '/otherwhere-vs-chatgpt': 'acquisition',
      '/what-is-ai-travel-concierge': 'comprehension',
      '/case-studies/*': 'trust',
      '/destinations/*': 'acquisition',
    };
  }
}

/**
 * Match page path to content role (supports wildcards)
 */
function getPageRole(pagePath, roles) {
  // Direct match first
  if (roles[pagePath]) return roles[pagePath];

  // Wildcard match
  for (const [pattern, role] of Object.entries(roles)) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      if (pagePath.startsWith(prefix)) return role;
    }
  }

  return 'acquisition'; // Default
}

/**
 * Classify page into bucket A-F based on metrics and role
 */
function classifyPage(pagePath, metrics, role) {
  const m = metrics;
  const hasConversions = m.events && Object.values(m.events).some(v => v > 0);
  const exitRate = m.entrances > 0 ? m.exits / m.entrances : 0;

  // Bucket A: Winners
  if (m.pageviews >= THRESHOLDS.highImpressions &&
      m.avgEngagement >= THRESHOLDS.strongEngagement &&
      hasConversions) {
    return 'A';
  }

  // Bucket B: High Intent, Low CTR (needs title/meta work)
  if (m.pageviews >= THRESHOLDS.highImpressions &&
      m.entrances < m.pageviews * THRESHOLDS.lowCTR) {
    return 'B';
  }

  // Bucket C: Good Engagement, No Conversion
  if (m.avgEngagement >= THRESHOLDS.strongEngagement && !hasConversions) {
    return 'C';
  }

  // Bucket D: Entry but Exit
  if (m.entrances >= THRESHOLDS.highEntrances &&
      exitRate >= THRESHOLDS.highExitRate) {
    return 'D';
  }

  // Bucket F: Dead Weight
  if (m.pageviews < THRESHOLDS.lowImpressions &&
      m.avgEngagement < THRESHOLDS.strongEngagement) {
    return 'F';
  }

  // Default: No action needed
  return null;
}

/**
 * Generate actions based on bucket and role
 */
function generateActions(bucket, role) {
  const actions = [];

  // Role-based guardrails
  if (role === 'trust') {
    // Trust pages: manual review only
    return ['flag_for_review'];
  }

  switch (bucket) {
    case 'A': // Winners
      actions.push('expand_topic_cluster');
      actions.push('add_internal_links_to');
      actions.push('add_faq_block');
      break;

    case 'B': // High Intent, Low CTR
      actions.push('rewrite_meta');
      actions.push('add_quick_answer');
      break;

    case 'C': // Good Engagement, No Conversion
      if (role !== 'comprehension') {
        actions.push('swap_cta_variant');
        actions.push('add_mid_article_cta');
      }
      break;

    case 'D': // Entry but Exit
      actions.push('add_next_steps_section');
      actions.push('strengthen_internal_links');
      actions.push('add_related_content');
      break;

    case 'F': // Dead Weight
      if (role === 'comprehension') {
        actions.push('flag_for_review');
      } else {
        actions.push('consider_noindex');
        actions.push('rewrite_with_new_angle');
      }
      break;
  }

  return actions;
}

/**
 * Main analysis function
 */
async function analyzePerformance() {
  console.log('📊 Starting GA4 performance analysis...\n');

  const metrics = await fetchGA4Metrics();
  const roles = await getContentRoles();
  const results = [];
  const summary = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, unchanged: 0 };

  for (const [pagePath, pageMetrics] of Object.entries(metrics)) {
    const role = getPageRole(pagePath, roles);
    const bucket = classifyPage(pagePath, pageMetrics, role);

    if (bucket) {
      const actions = generateActions(bucket, role);
      results.push({
        slug: pagePath,
        content_role: role,
        bucket,
        actions,
        metrics: {
          pageviews: pageMetrics.pageviews,
          entrances: pageMetrics.entrances,
          avgEngagement: Math.round(pageMetrics.avgEngagement),
          hasConversions: !!(pageMetrics.events && Object.values(pageMetrics.events).some(v => v > 0)),
        },
        analyzed_at: new Date().toISOString(),
      });
      summary[bucket]++;
    } else {
      summary.unchanged++;
    }
  }

  // Write results
  const outputPath = path.join(process.cwd(), 'data', 'content-performance.json');
  await fs.writeFile(outputPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    period: '28_days',
    summary,
    pages: results,
  }, null, 2));

  console.log('📈 Analysis complete!\n');
  console.log('Summary:');
  console.log(`  🏆 Bucket A (Winners): ${summary.A}`);
  console.log(`  🎯 Bucket B (Low CTR): ${summary.B}`);
  console.log(`  💬 Bucket C (No Conversion): ${summary.C}`);
  console.log(`  🚪 Bucket D (Entry/Exit): ${summary.D}`);
  console.log(`  ⚠️  Bucket F (Dead Weight): ${summary.F}`);
  console.log(`  ✅ Unchanged: ${summary.unchanged}`);
  console.log(`\nResults saved to: ${outputPath}`);

  return results;
}

// Run if called directly
analyzePerformance().catch(console.error);

export { analyzePerformance, classifyPage, generateActions };
