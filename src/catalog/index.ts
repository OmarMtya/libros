export { BOOK_FEATURE_DEFINITIONS, BOOK_FEATURE_SCHEMA_VERSION, featureDefinition, REQUIRED_FEATURES, REQUIRED_FEATURES_SET } from './book-feature-definitions';
export type { BookFeatureDefinition, FeatureScope } from './book-feature-definitions';
export { CONTENT_TYPES, CONTENT_TYPE_KEYS, CONTENT_TYPE_SCHEMA_VERSION, isContentTypeKey } from './content-type-definitions';
export type { ContentTypeDefinition, ContentTypeKey } from './content-type-definitions';
export { applicabilityFor, buildApplicabilityMatrix, CONTENT_TYPE_RULES } from './book-feature-applicability';
export type { FeatureApplicabilityRow, Requirement } from './book-feature-applicability';
