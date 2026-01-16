// Shared author utilities for consistent attribution across the site

export const AUTHORS = ['Maddy S.', 'Nick D.', 'Juan Q.'] as const;

export type Author = typeof AUTHORS[number];

/**
 * Get a deterministic author based on a slug
 * Same slug always returns same author for consistency
 */
export function getAuthorFromSlug(slug: string): Author {
  const hash = Math.abs(
    slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  );
  return AUTHORS[hash % AUTHORS.length];
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get the first keyword or fallback category from a post
 */
export function getCategoryFromPost(post: { keywords?: string[]; pillar?: string }): string {
  return post.keywords?.[0] || post.pillar?.replace(/-/g, ' ') || 'Travel';
}
