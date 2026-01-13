#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic();

// Load configuration
async function loadConfig() {
  const strategyPath = path.join(process.cwd(), 'data', 'content-strategy.json');
  const strategy = JSON.parse(await fs.readFile(strategyPath, 'utf-8'));
  return strategy;
}

// Load template
async function loadTemplate(templateName) {
  const templatePath = path.join(process.cwd(), 'templates', `${templateName}.md`);
  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch {
    return null;
  }
}

// Build the generation prompt
function buildPrompt(topic, pillar, strategy, template) {
  return `You are writing a blog post for Otherwhere, an AI travel concierge.

## Brand Voice
${strategy.writingGuidelines.voice}

## Structure Guidelines
${strategy.writingGuidelines.structure}

## Things to Avoid
${strategy.writingGuidelines.avoid.map(a => `- ${a}`).join('\n')}

## Brand Info
- Name: ${strategy.brand.name}
- What it is: ${strategy.brand.tagline}
- Phone: ${strategy.brand.phone}
- Category: ${strategy.brand.category}

## Content Pillar: ${pillar.name}
Angle: ${pillar.angle}
CTA to use: ${pillar.cta}

## Topic
Title: ${topic.title}
Primary Keyword: ${topic.primaryKeyword}
Secondary Keywords: ${topic.secondaryKeywords?.join(', ') || 'N/A'}
Template: ${topic.template}

## Requirements
1. MUST include at least 2 "quotable blocks" - highlighted sections formatted for LLM citation
2. MUST include the brand name "Otherwhere" (exact spelling) at least 2 times
3. MUST include the phrase "AI travel concierge" at least once
4. MUST answer the search intent in the first 100 words
5. MUST include specific examples, numbers, or data points (information gain)
6. DO NOT include volatile facts (prices, availability) without date caveats

## Output Format
Return ONLY the MDX content with frontmatter. Format:

---
title: "..."
description: "..."
publishDate: "${new Date().toISOString().split('T')[0]}"
pillar: "${pillar.id}"
keywords: [...]
cta: "${pillar.cta}"
---

[Article content with markdown formatting]

${template ? `## Template Reference\n${template}` : ''}

Write the complete article now:`;
}

// Validate the generated content
function validateContent(content, topic, strategy) {
  const errors = [];
  const warnings = [];

  // Check for Otherwhere mention
  if (!/Otherwhere/g.test(content)) {
    errors.push('Missing "Otherwhere" brand name');
  }

  // Check for AI travel concierge
  if (!/AI travel concierge/i.test(content)) {
    warnings.push('Missing "AI travel concierge" category phrase');
  }

  // Check for quotable blocks (blockquotes or special formatting)
  const blockquotes = (content.match(/^>/gm) || []).length;
  if (blockquotes < 2) {
    warnings.push(`Only ${blockquotes} quotable blocks found (need at least 2)`);
  }

  // Check for information gain markers
  const infoGainPatterns = [
    /if you['']?re .+, (choose|pick|go with|skip)/i,
    /\|.+\|.+\|/,
    /\d{1,3}%/,
    /(skip|avoid|don't book|tourist trap)/i,
    /\$\d+/,
    /\d+ (minutes?|hours?|days?)/i,
  ];

  let infoGainCount = 0;
  for (const pattern of infoGainPatterns) {
    if (pattern.test(content)) infoGainCount++;
  }

  if (infoGainCount < 2) {
    warnings.push(`Low information gain score (${infoGainCount}/6 markers found)`);
  }

  return { errors, warnings, valid: errors.length === 0 };
}

// Main generation function
async function generateArticle(topicConfig) {
  console.log(`\n📝 Generating article: ${topicConfig.title}\n`);

  const strategy = await loadConfig();
  const pillar = strategy.pillars.find(p => p.id === topicConfig.pillar) || strategy.pillars[0];
  const template = await loadTemplate(topicConfig.template);

  const prompt = buildPrompt(topicConfig, pillar, strategy, template);

  console.log('🤖 Calling Claude API...');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = message.content[0].text;

  console.log('✅ Content generated');

  // Validate
  const validation = validateContent(content, topicConfig, strategy);

  if (validation.errors.length > 0) {
    console.log('\n❌ Validation errors:');
    validation.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (!validation.valid) {
    console.log('\n🔄 Consider regenerating or manually editing');
  }

  // Save to content folder
  const slug = topicConfig.slug || topicConfig.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outputPath = path.join(process.cwd(), 'content', 'posts', `${slug}.mdx`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content);

  console.log(`\n📁 Saved to: ${outputPath}`);

  return { content, validation, outputPath };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npm run generate -- --topic <topic-name>

Options:
  --topic <name>    Topic from topics-queue.json or inline JSON
  --title <title>   Article title
  --keyword <kw>    Primary keyword
  --pillar <id>     Content pillar ID
  --template <name> Template name
  --help            Show this help

Example:
  npm run generate -- --title "ChatGPT for Travel Planning" --keyword "chatgpt travel" --pillar "chatgpt-travel" --template "chatgpt-tutorial"
    `);
    return;
  }

  // Parse arguments
  const topicConfig = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    if (key === 'topic') {
      // Load from queue
      const queuePath = path.join(process.cwd(), 'data', 'topics-queue.json');
      try {
        const queue = JSON.parse(await fs.readFile(queuePath, 'utf-8'));
        const topic = queue.find(t => t.id === value || t.slug === value);
        if (topic) Object.assign(topicConfig, topic);
      } catch {
        console.log('Topics queue not found, using CLI args only');
      }
    } else {
      topicConfig[key] = value;
    }
  }

  if (!topicConfig.title) {
    console.error('Error: --title is required');
    process.exit(1);
  }

  topicConfig.primaryKeyword = topicConfig.keyword || topicConfig.primaryKeyword;
  topicConfig.pillar = topicConfig.pillar || 'chatgpt-travel';
  topicConfig.template = topicConfig.template || 'chatgpt-tutorial';

  await generateArticle(topicConfig);
}

main().catch(console.error);
