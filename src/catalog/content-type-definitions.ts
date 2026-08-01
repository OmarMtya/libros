export const CONTENT_TYPE_SCHEMA_VERSION = 'content-types/1.0';

export const CONTENT_TYPE_KEYS = [
  'fiction',
  'narrative_nonfiction',
  'expository_nonfiction',
  'memoir',
  'essay',
  'short_stories',
  'poetry',
  'other',
] as const;

export type ContentTypeKey = (typeof CONTENT_TYPE_KEYS)[number];

export type ContentTypeDefinition = {
  contentTypeKey: ContentTypeKey;
  name: string;
  schemaVersion: string;
  isActive: boolean;
};

export const CONTENT_TYPES: ContentTypeDefinition[] = CONTENT_TYPE_KEYS.map((contentTypeKey) => ({
  contentTypeKey,
  name: contentTypeKey.replaceAll('_', ' '),
  schemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
  isActive: true,
}));

export function isContentTypeKey(value: string): value is ContentTypeKey {
  return (CONTENT_TYPE_KEYS as readonly string[]).includes(value);
}
