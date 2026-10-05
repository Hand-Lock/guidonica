export interface PostLimit {
  limit: number;
  count: (text: string) => number;
}
export interface BlueskyFacet {
  index: { byteStart: number; byteEnd: number };
  features: Record<string, string>[];
}

export const SITE_URL: string;
export const HASHTAGS: string;
export const BLUESKY: PostLimit;
export const MASTODON: PostLimit;
export function graphemes(text: string): number;
export function mastodonLength(text: string): number;
export function buildThread(md: string, version: string, platform: PostLimit): string[];
export function blueskyFacets(text: string): BlueskyFacet[];
