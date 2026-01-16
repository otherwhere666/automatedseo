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

// Lifestyle-focused fallback images
const FALLBACK_IMAGES = [
  'photo-1507608616759-54f48f0af0ee', // woman at cafe table
  'photo-1517457373958-b7bdd4587205', // couple walking cobblestone street
  'photo-1520250497591-112f2f40a3f4', // hotel pool lifestyle
  'photo-1540541338287-41700207dee6', // person by infinity pool
  'photo-1544161515-4ab6ce6db874', // spa/wellness moment
  'photo-1566073771259-6a8506099945', // boutique hotel terrace
  'photo-1551882547-ff40c63fe5fa', // luxury hotel lobby
  'photo-1582719508461-905c673771fd', // rooftop bar sunset
  'photo-1571896349842-33c89424de2d', // hotel room view
  'photo-1542314831-068cd1dbfeeb', // resort walkway
  'photo-1445019980597-93fa8acb246c', // morning coffee balcony
  'photo-1596394516093-501ba68a0ba6', // poolside lounging
  'photo-1414235077428-338989a2e8c0', // fine dining table
  'photo-1559599746-c0f31a628657', // aperitivo scene
  'photo-1504674900247-0877df9cc836', // food lifestyle
];

// Track recently used images to avoid duplicates
const USED_IMAGES_FILE = path.join(process.cwd(), 'data', 'used-images.json');
const MAX_USED_IMAGES = 30; // Remember last 30 images

async function getUsedImages() {
  try {
    const data = await fs.readFile(USED_IMAGES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function trackUsedImage(imageId) {
  const used = await getUsedImages();
  used.unshift(imageId);
  // Keep only last N images
  const trimmed = used.slice(0, MAX_USED_IMAGES);
  await fs.writeFile(USED_IMAGES_FILE, JSON.stringify(trimmed, null, 2));
}

async function searchUnsplash(query, usedImages = []) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.log('⚠️  No UNSPLASH_ACCESS_KEY, using fallback image');
    return null;
  }

  // Add lifestyle modifiers for better imagery
  const lifestyleModifiers = ['lifestyle', 'aesthetic', 'luxury', 'boutique'];
  const modifier = lifestyleModifiers[Math.floor(Math.random() * lifestyleModifiers.length)];

  try {
    const searchQuery = encodeURIComponent(`${query} ${modifier} travel`);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${searchQuery}&orientation=landscape&per_page=20`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    );

    if (!response.ok) {
      console.log(`⚠️  Unsplash API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Filter out recently used images
      const available = data.results.filter(photo => !usedImages.includes(photo.id));

      if (available.length === 0) {
        console.log('⚠️  All search results recently used, picking from full set');
        available.push(...data.results);
      }

      // Pick randomly from available results
      const photo = available[Math.floor(Math.random() * available.length)];
      console.log(`📷 Found image: "${photo.alt_description || photo.description || query}" (${modifier})`);

      // Track this image
      await trackUsedImage(photo.id);

      return {
        url: `${photo.urls.raw}&w=1600&h=900&fit=crop`,
        alt: photo.alt_description || photo.description || `${query} travel scene`,
        id: photo.id
      };
    }
  } catch (error) {
    console.log(`⚠️  Unsplash search failed: ${error.message}`);
  }
  return null;
}

async function getUnsplashImage(topicTitle) {
  // Load recently used images
  const usedImages = await getUsedImages();

  // Extract key terms from title for search
  const searchTerms = topicTitle
    .replace(/[^a-zA-Z\s]/g, '')
    .split(' ')
    .filter(word => word.length > 3 && !['what', 'how', 'why', 'the', 'and', 'for', 'with', 'that', 'this', 'your', 'honest', 'review', 'guide', 'complete'].includes(word.toLowerCase()))
    .slice(0, 3)
    .join(' ');

  const result = await searchUnsplash(searchTerms, usedImages);
  if (result) {
    return result;
  }

  // Fallback: rotate through list, avoiding recently used
  const availableFallbacks = FALLBACK_IMAGES.filter(id => !usedImages.includes(id));
  const fallbackId = availableFallbacks.length > 0
    ? availableFallbacks[0]
    : FALLBACK_IMAGES[0];

  await trackUsedImage(fallbackId);

  return {
    url: `https://images.unsplash.com/${fallbackId}?w=1600&h=900&fit=crop`,
    alt: 'Travel lifestyle moment'
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
