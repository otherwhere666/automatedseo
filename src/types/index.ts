// Destination Types
export interface TravelerType {
  name: string;
  stayIn: string;
  why: string;
  pick: string;
  price: string;
}

export interface SkipItem {
  name: string;
  reason: string;
}

export interface Destination {
  slug: string;
  city: string;
  country: string;
  region: string;
  tagline: string;
  image: string;
  imageAlt: string;
  quickTake: string;
  travelerTypes: TravelerType[];
  skip: SkipItem[];
  lastUpdated: string;
}

// Case Study Types
export interface EliminatedOption {
  name: string;
  reason: string;
}

export interface ConsideredOption {
  name: string;
  reason: string;
}

export interface FinalBooking {
  property: string;
  why: string;
  price: string;
  extras?: string;
}

export interface TimeSaved {
  diy: string;
  otherwhere: string;
}

export interface CaseStudy {
  slug: string;
  title: string;
  destination: string;
  type: string;
  image: string;
  imageAlt: string;
  travelerType: string;
  budget: string;
  timeline: string;
  quote: string;
  constraints: string[];
  eliminated: EliminatedOption[];
  considered: ConsideredOption[];
  recommended: string;
  finalBooking: FinalBooking;
  timeSaved: TimeSaved;
  outcome: string;
}

// Case Study Summary (for index pages)
export interface CaseStudySummary {
  slug: string;
  title: string;
  destination: string;
  type: string;
  quote: string;
  budget: string;
  result: string;
  time: string;
  image: string;
}

// Blog Post Types
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  updateDate?: string;
  image?: string;
  imageAlt?: string;
  pillar?: string;
  keywords?: string[];
  author?: string;
  readingTime?: string;
  noindex?: boolean;
}

// Pillar/Topic Types
export interface Pillar {
  id: string;
  name: string;
  angle: string;
  cta: string;
  priority: 'high' | 'medium' | 'low';
}

// Related Content Types
export interface RelatedItem {
  type: 'post' | 'destination' | 'case-study';
  slug: string;
  title: string;
  description?: string;
  image?: string;
}

// Destination Summary (for index pages)
export interface DestinationSummary {
  slug: string;
  city: string;
  country: string;
  region: string;
  tagline: string;
  image: string;
}
