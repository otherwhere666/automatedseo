import fs from 'node:fs';
import path from 'node:path';
import type {
  Destination,
  DestinationSummary,
  CaseStudy,
  CaseStudySummary,
  BlogPost,
  RelatedItem,
  Pillar
} from '../types';

// Base paths
const DATA_DIR = path.join(process.cwd(), 'data');
const CONTENT_DIR = path.join(process.cwd(), 'content');

// ============================================
// Destinations
// ============================================

export function getAllDestinations(): Destination[] {
  const filePath = path.join(DATA_DIR, 'destinations.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function getDestinationBySlug(slug: string): Destination | undefined {
  const destinations = getAllDestinations();
  return destinations.find(d => d.slug === slug);
}

export function getDestinationSummaries(): DestinationSummary[] {
  return getAllDestinations().map(d => ({
    slug: d.slug,
    city: d.city,
    country: d.country,
    region: d.region,
    tagline: d.tagline,
    image: d.image
  }));
}

export function getDestinationsByRegion(): Record<string, DestinationSummary[]> {
  const destinations = getDestinationSummaries();
  return destinations.reduce((acc, d) => {
    if (!acc[d.region]) acc[d.region] = [];
    acc[d.region].push(d);
    return acc;
  }, {} as Record<string, DestinationSummary[]>);
}

export function getDestinationSlugs(): string[] {
  return getAllDestinations().map(d => d.slug);
}

// ============================================
// Case Studies
// ============================================

export function getAllCaseStudies(): CaseStudy[] {
  const filePath = path.join(DATA_DIR, 'case-studies.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function getCaseStudyBySlug(slug: string): CaseStudy | undefined {
  const caseStudies = getAllCaseStudies();
  return caseStudies.find(cs => cs.slug === slug);
}

export function getCaseStudySummaries(): CaseStudySummary[] {
  return getAllCaseStudies().map(cs => ({
    slug: cs.slug,
    title: cs.title,
    destination: cs.destination,
    type: cs.type,
    quote: cs.quote,
    budget: cs.budget,
    result: cs.finalBooking.price,
    time: cs.timeSaved.otherwhere,
    image: cs.image
  }));
}

export function getCaseStudySlugs(): string[] {
  return getAllCaseStudies().map(cs => cs.slug);
}

// ============================================
// Blog Posts
// ============================================

export function getAllPosts(): BlogPost[] {
  const postsDir = path.join(CONTENT_DIR, 'posts');
  const posts: BlogPost[] = [];

  try {
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.mdx'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const slug = file.replace('.mdx', '');

        posts.push({
          slug,
          title: extractFrontmatterValue(frontmatter, 'title') || 'Untitled',
          description: extractFrontmatterValue(frontmatter, 'description') || '',
          publishDate: extractFrontmatterValue(frontmatter, 'publishDate') || '',
          updateDate: extractFrontmatterValue(frontmatter, 'updateDate'),
          image: extractFrontmatterValue(frontmatter, 'image'),
          imageAlt: extractFrontmatterValue(frontmatter, 'imageAlt'),
          pillar: extractFrontmatterValue(frontmatter, 'pillar'),
          keywords: extractFrontmatterArray(frontmatter, 'keywords'),
          author: extractFrontmatterValue(frontmatter, 'author'),
          readingTime: extractFrontmatterValue(frontmatter, 'readingTime'),
          noindex: extractFrontmatterValue(frontmatter, 'noindex') === 'true'
        });
      }
    }

    // Sort by date, newest first
    posts.sort((a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );
  } catch (e) {
    // No posts directory or empty
  }

  return posts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const posts = getAllPosts();
  return posts.find(p => p.slug === slug);
}

export function getPostSlugs(): string[] {
  return getAllPosts().map(p => p.slug);
}

export function getPostsByPillar(pillar: string): BlogPost[] {
  return getAllPosts().filter(p => p.pillar === pillar);
}

export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tags = new Set<string>();

  posts.forEach(post => {
    post.keywords?.forEach(keyword => tags.add(keyword));
  });

  return Array.from(tags).sort();
}

export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter(p => p.keywords?.includes(tag));
}

// ============================================
// Pillars/Topics
// ============================================

export function getAllPillars(): Pillar[] {
  const filePath = path.join(DATA_DIR, 'content-strategy.json');
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.pillars || [];
  } catch (e) {
    return [];
  }
}

export function getPillarById(id: string): Pillar | undefined {
  return getAllPillars().find(p => p.id === id);
}

// ============================================
// Related Content
// ============================================

export function getRelatedContent(
  currentSlug: string,
  currentType: 'post' | 'destination' | 'case-study',
  options: {
    pillar?: string;
    keywords?: string[];
    destination?: string;
    limit?: number;
  } = {}
): RelatedItem[] {
  const { pillar, keywords = [], destination, limit = 3 } = options;
  const related: RelatedItem[] = [];
  const scores: Map<string, number> = new Map();

  // Score blog posts
  const posts = getAllPosts();
  posts.forEach(post => {
    if (currentType === 'post' && post.slug === currentSlug) return;

    let score = 0;
    const key = `post:${post.slug}`;

    // Same pillar = high relevance
    if (pillar && post.pillar === pillar) score += 10;

    // Shared keywords
    const sharedKeywords = keywords.filter(k => post.keywords?.includes(k));
    score += sharedKeywords.length * 3;

    // Destination mentioned in title or description
    if (destination) {
      const destLower = destination.toLowerCase();
      if (post.title.toLowerCase().includes(destLower)) score += 5;
      if (post.description.toLowerCase().includes(destLower)) score += 3;
    }

    if (score > 0) {
      scores.set(key, score);
      related.push({
        type: 'post',
        slug: post.slug,
        title: post.title,
        description: post.description,
        image: post.image
      });
    }
  });

  // Score destinations
  if (currentType !== 'destination') {
    const destinations = getAllDestinations();
    destinations.forEach(dest => {
      let score = 0;
      const key = `destination:${dest.slug}`;

      // Destination name mentioned
      if (destination && dest.city.toLowerCase() === destination.toLowerCase()) {
        score += 15;
      }

      // Keywords match city or country
      keywords.forEach(k => {
        const kLower = k.toLowerCase();
        if (dest.city.toLowerCase().includes(kLower)) score += 5;
        if (dest.country.toLowerCase().includes(kLower)) score += 3;
      });

      if (score > 0) {
        scores.set(key, score);
        related.push({
          type: 'destination',
          slug: dest.slug,
          title: `Where to Stay in ${dest.city}`,
          description: dest.quickTake,
          image: dest.image
        });
      }
    });
  }

  // Score case studies
  if (currentType !== 'case-study') {
    const caseStudies = getAllCaseStudies();
    caseStudies.forEach(cs => {
      let score = 0;
      const key = `case-study:${cs.slug}`;

      // Destination match
      if (destination && cs.destination.toLowerCase().includes(destination.toLowerCase())) {
        score += 15;
      }

      // Keywords in destination or type
      keywords.forEach(k => {
        const kLower = k.toLowerCase();
        if (cs.destination.toLowerCase().includes(kLower)) score += 5;
        if (cs.type.toLowerCase().includes(kLower)) score += 3;
      });

      if (score > 0) {
        scores.set(key, score);
        related.push({
          type: 'case-study',
          slug: cs.slug,
          title: cs.title,
          description: cs.quote,
          image: cs.image
        });
      }
    });
  }

  // Sort by score and return top results
  return related
    .sort((a, b) => {
      const scoreA = scores.get(`${a.type}:${a.slug}`) || 0;
      const scoreB = scores.get(`${b.type}:${b.slug}`) || 0;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

// Get related case studies for a destination
export function getCaseStudiesForDestination(city: string): CaseStudySummary[] {
  const caseStudies = getAllCaseStudies();
  const cityLower = city.toLowerCase();

  return caseStudies
    .filter(cs => cs.destination.toLowerCase().includes(cityLower))
    .map(cs => ({
      slug: cs.slug,
      title: cs.title,
      destination: cs.destination,
      type: cs.type,
      quote: cs.quote,
      budget: cs.budget,
      result: cs.finalBooking.price,
      time: cs.timeSaved.otherwhere,
      image: cs.image
    }));
}

// Get related blog posts for a destination
export function getPostsForDestination(city: string): BlogPost[] {
  const posts = getAllPosts();
  const cityLower = city.toLowerCase();

  return posts.filter(post => {
    const titleMatch = post.title.toLowerCase().includes(cityLower);
    const descMatch = post.description.toLowerCase().includes(cityLower);
    const keywordMatch = post.keywords?.some(k => k.toLowerCase().includes(cityLower));
    return titleMatch || descMatch || keywordMatch;
  });
}

// ============================================
// Helper Functions
// ============================================

function extractFrontmatterValue(frontmatter: string, key: string): string | undefined {
  const match = frontmatter.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match?.[1];
}

function extractFrontmatterArray(frontmatter: string, key: string): string[] | undefined {
  const match = frontmatter.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
  if (!match) return undefined;

  return match[1]
    .split(',')
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

// Get current year for SEO titles
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Format date for display
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
