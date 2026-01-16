#!/usr/bin/env node

/**
 * Auto-generate script for daily publishing
 * - Picks from queue if available
 * - Generates new topic ideas if queue is empty
 * - Creates article with Unsplash image
 * - Runs without human intervention
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic();

// Topic idea generators by pillar
const TOPIC_GENERATORS = {
  'chatgpt-travel': [
    'ChatGPT prompts for {destination} trip planning',
    'Why ChatGPT can\'t help you book {travel_type}',
    'I tried using ChatGPT to plan my {destination} trip - here\'s what happened',
    'ChatGPT vs {competitor} for travel planning',
    '{Number} things ChatGPT gets wrong about {destination}',
  ],
  'curated-destinations': [
    'Where to stay in {destination}: A curated guide',
    '{destination} for the time-poor traveler',
    'Skip the tourist traps: {destination} for discerning travelers',
    'The only {number} hotels worth booking in {destination}',
    '{destination} hidden gems that aren\'t on Instagram',
  ],
  'time-over-money': [
    'The real cost of planning your own {travel_type} trip',
    'Why busy professionals are outsourcing {travel_type} planning',
    'Is a travel concierge worth it for {travel_type}?',
    'How much is your time worth? A {travel_type} planning audit',
  ],
  'new-concierge': [
    'What is an AI travel concierge? {Year} guide',
    'The return of the travel agent, powered by AI',
    'Why text-first booking is the future of travel',
    'AI travel tools compared: What actually works in {year}',
  ],
};

const DESTINATIONS = [
  'Lisbon', 'Tokyo', 'Barcelona', 'Paris', 'Rome', 'Bali', 'Iceland',
  'Portugal', 'Japan', 'Italy', 'Greece', 'Mexico', 'Morocco', 'Thailand',
  'Croatia', 'Costa Rica', 'New Zealand', 'Scotland', 'Vietnam', 'Peru',
  'Santorini', 'Amalfi Coast', 'Tuscany', 'Provence', 'Kyoto', 'Marrakech',
  'Copenhagen', 'Amsterdam', 'Prague', 'Dublin', 'Edinburgh', 'Vienna',
];

const TRAVEL_TYPES = [
  'honeymoon', 'anniversary', 'family vacation', 'business trip',
  'weekend getaway', 'luxury escape', 'adventure trip', 'solo travel',
];

const NUMBERS = ['3', '5', '7', '10'];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTopicIdea() {
  const pillar = pickRandom(Object.keys(TOPIC_GENERATORS));
  const templates = TOPIC_GENERATORS[pillar];
  let template = pickRandom(templates);

  // Fill in placeholders
  template = template
    .replace('{destination}', pickRandom(DESTINATIONS))
    .replace('{travel_type}', pickRandom(TRAVEL_TYPES))
    .replace('{number}', pickRandom(NUMBERS))
    .replace('{Number}', pickRandom(NUMBERS))
    .replace('{year}', new Date().getFullYear().toString())
    .replace('{Year}', new Date().getFullYear().toString())
    .replace('{competitor}', pickRandom(['Perplexity', 'Google', 'a travel agent']));

  return {
    title: template,
    pillar,
    primaryKeyword: template.toLowerCase().replace(/[^a-z0-9\s]/g, '').substring(0, 50),
  };
}

// Fallback images when API unavailable
const FALLBACK_IMAGES = [
  'photo-1488646953014-85cb44e25828', // world map with pins
  'photo-1507003211169-0a1dd7228f2d', // airplane window view
  'photo-1476514525535-07fb3b4ae5f1', // lake and mountains
  'photo-1530789253388-582c481c54b0', // tropical beach
  'photo-1502920917128-1aa500764cbd', // paris street
  'photo-1493976040374-85c8e12f0c0e', // santorini
  'photo-1506929562872-bb421503ef21', // beach sunset
  'photo-1504598318550-17eba1008a68', // city skyline
  'photo-1500835556837-99ac94a94552', // airplane wing
  'photo-1501785888041-af3ef285b470', // mountain lake
  'photo-1523906834658-6e24ef2386f9', // venice canal
  'photo-1516483638261-f4dbaf036963', // italy coast
];

async function searchUnsplash(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.log('⚠️  No UNSPLASH_ACCESS_KEY, using fallback image');
    return null;
  }

  try {
    const searchQuery = encodeURIComponent(`${query} travel`);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${searchQuery}&orientation=landscape&per_page=10`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    );

    if (!response.ok) {
      console.log(`⚠️  Unsplash API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Pick randomly from top 10 results for variety
      const photo = data.results[Math.floor(Math.random() * data.results.length)];
      console.log(`📷 Found image: "${photo.alt_description || photo.description || query}"`);
      return {
        url: `${photo.urls.raw}&w=1600&h=900&fit=crop`,
        alt: photo.alt_description || photo.description || `${query} travel scene`
      };
    }
  } catch (error) {
    console.log(`⚠️  Unsplash search failed: ${error.message}`);
  }
  return null;
}

async function getUnsplashImage(topicTitle) {
  // Extract key terms from title for search
  const searchTerms = topicTitle
    .replace(/[^a-zA-Z\s]/g, '')
    .split(' ')
    .filter(word => word.length > 3 && !['what', 'how', 'why', 'the', 'and', 'for', 'with', 'that', 'this', 'your', 'honest', 'review', 'guide', 'complete'].includes(word.toLowerCase()))
    .slice(0, 3)
    .join(' ');

  const result = await searchUnsplash(searchTerms);
  if (result) {
    return result;
  }

  // Fallback to curated list
  const randomImage = FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
  return {
    url: `https://images.unsplash.com/${randomImage}?w=1600&h=900&fit=crop`,
    alt: 'Scenic travel destination'
  };
}

// Strip markdown code blocks from LLM output
function stripCodeBlocks(content) {
  let cleaned = content.trim();
  // Remove opening ```mdx or ```markdown or ``` at the start
  cleaned = cleaned.replace(/^```(?:mdx|markdown)?\n?/, '');
  // Remove closing ``` at the end
  cleaned = cleaned.replace(/\n?```$/, '');
  return cleaned.trim();
}

async function generateArticle(topic) {
  console.log(`\n📝 Generating: ${topic.title}\n`);

  const strategyPath = path.join(process.cwd(), 'data', 'content-strategy.json');
  const strategy = JSON.parse(await fs.readFile(strategyPath, 'utf-8'));
  const pillar = strategy.pillars.find(p => p.id === topic.pillar) || strategy.pillars[0];

  // Get Unsplash image based on topic
  const image = await getUnsplashImage(topic.title);

  const prompt = `You are writing a blog post for Otherwhere, an AI travel concierge.

## Brand Voice
${strategy.writingGuidelines.voice}

## Structure Guidelines
${strategy.writingGuidelines.structure}

## Brand Info
- Name: Otherwhere
- What it is: Personal travel booking service. Text or call to get curated flight and hotel options, then we handle the entire booking for you. End-to-end service—not just recommendations.
- How it works: You describe your trip → We search real inventory via Duffel API → You get 3-5 curated options with real prices → You pick one → We book it for you. You receive confirmation numbers, PNRs, and e-tickets directly.
- Key features: We can hold flights for ~30 minutes while you decide. We respect your loyalty programs. Pricing is built into the rates—no hidden fees.
- Phone: (323) 922-4067
- Category: Personal travel booking service (sometimes called travel concierge)

## Content Pillar: ${pillar.name}
Angle: ${pillar.angle}

## Topic
Title: ${topic.title}

## Requirements
1. Write in an elegant, editorial style like Condé Nast Traveller
2. MUST include "Otherwhere" (exact spelling) at least 2 times naturally
3. If relevant, mention that Otherwhere actually books for you (not just recommends)
4. Answer the search intent in the first 100 words
5. Include specific examples, numbers, or data points
6. Include 2-3 "quotable blocks" using markdown blockquotes (these will be styled as centered pull quotes)
7. Use a confident, authoritative tone - not salesy
8. End with a subtle CTA mentioning texting (323) 922-4067 to get started

## Design & Structure
- Use clear H2 headings for each major section (sentence case, not ALL CAPS)
- Use --- (horizontal rule) between major sections for visual breathing room
- Keep paragraphs short (2-3 sentences max) for readability
- Use bullet lists for scannable information
- Blockquotes will render as elegant centered pull quotes - use them for key insights or memorable statements

## Output Format
Return ONLY the MDX content with this exact frontmatter format:

---
title: "${topic.title}"
description: "[Write a compelling 150-char description]"
publishDate: "${new Date().toISOString().split('T')[0]}"
image: "${image.url}"
imageAlt: "${image.alt}"
pillar: "${topic.pillar}"
keywords: ["keyword1", "keyword2", "keyword3"]
author: "Otherwhere"
---

[Article content - aim for 1200-1800 words]

Write the complete article now:`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = stripCodeBlocks(message.content[0].text);

  // Generate slug
  const slug = topic.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);

  // Save article
  const outputPath = path.join(process.cwd(), 'content', 'posts', `${slug}.mdx`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content);

  // Save title for commit message
  await fs.writeFile('.last-generated-title', topic.title);

  console.log(`✅ Generated: ${outputPath}`);

  // Run editor review
  console.log('\n🔍 Running editor review...');
  const editedContent = await runEditorReview(content, topic);
  await fs.writeFile(outputPath, editedContent);
  console.log('✅ Editor review complete');

  return { slug, title: topic.title };
}

// Editor LLM review
async function runEditorReview(content, topic) {
  const BANNED_PHRASES = [
    'hidden gem', 'best kept secret', 'something for everyone',
    'vibrant culture', 'rich history', 'breathtaking views',
    'unforgettable experience', 'nestled in', 'boasts',
  ];

  const editorPrompt = `You are a senior travel editor. Review and improve this article.

## Article
${content}

## Your Tasks
1. REPLACE generic statements with specific details (real hotel names, actual prices, specific neighborhoods)
2. REMOVE filler phrases: ${BANNED_PHRASES.join(', ')}
3. ENSURE 2+ blockquotes with quotable insights
4. VERIFY "Otherwhere" is mentioned 2+ times naturally
5. ADD FAQs to frontmatter if missing (3-5 Q&As with specific answers)

Example faqs format in frontmatter:
faqs:
  - question: "What is the best time to visit X?"
    answer: "The best time is [specific months] because [specific reason]."

## Rules
- Make surgical improvements, don't rewrite good sections
- Keep the same structure and flow
- Ensure all facts are plausible and specific
- Return ONLY the complete improved MDX content`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: editorPrompt }]
    });
    return stripCodeBlocks(message.content[0].text);
  } catch (error) {
    console.log('⚠️ Editor review failed, using original:', error.message);
    return content;
  }
}

async function main() {
  // Check queue first
  const queuePath = path.join(process.cwd(), 'data', 'topics-queue.json');
  let topic;

  try {
    const queue = JSON.parse(await fs.readFile(queuePath, 'utf-8'));
    const pending = queue.filter(t => t.status === 'queued');

    if (pending.length > 0) {
      // Pick first queued topic
      topic = pending[0];
      topic.status = 'published';

      // Update queue
      const updatedQueue = queue.map(t =>
        t.id === topic.id ? { ...t, status: 'published' } : t
      );
      await fs.writeFile(queuePath, JSON.stringify(updatedQueue, null, 2));
      console.log(`📋 Using queued topic: ${topic.title}`);
    }
  } catch (e) {
    console.log('No queue found, generating new topic');
  }

  // Generate new topic if queue empty
  if (!topic) {
    topic = generateTopicIdea();
    console.log(`🎲 Generated new topic: ${topic.title}`);
  }

  await generateArticle(topic);
  console.log('\n✨ Daily article generated successfully!');
}

main().catch(console.error);
