-- CreateEnum
CREATE TYPE "AuthorRole" AS ENUM ('author', 'editor', 'contributor');

-- CreateEnum
CREATE TYPE "EditionContributorRole" AS ENUM ('translator', 'editor', 'narrator', 'contributor');

-- CreateEnum
CREATE TYPE "ClassificationStatus" AS ENUM ('draft', 'approved', 'superseded');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('active', 'replaced', 'canceled');

-- CreateEnum
CREATE TYPE "FeedbackCycleStatus" AS ENUM ('not_invited', 'invited', 'provisional_received', 'final_received', 'closed_without_feedback');

-- CreateEnum
CREATE TYPE "FeedbackInvitationStatus" AS ENUM ('pending', 'used', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('pending_processing', 'processed', 'stored_without_book_context', 'needs_clarification', 'needs_review', 'rejected');

-- AlterEnum
BEGIN;
CREATE TYPE "FulfillmentStatus_new" AS ENUM ('curation_pending', 'assigned', 'packed', 'shipped', 'delivered', 'canceled');
ALTER TABLE "public"."fulfillments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "fulfillments" ALTER COLUMN "status" TYPE "FulfillmentStatus_new" USING ("status"::text::"FulfillmentStatus_new");
ALTER TYPE "FulfillmentStatus" RENAME TO "FulfillmentStatus_old";
ALTER TYPE "FulfillmentStatus_new" RENAME TO "FulfillmentStatus";
DROP TYPE "public"."FulfillmentStatus_old";
ALTER TABLE "fulfillments" ALTER COLUMN "status" SET DEFAULT 'curation_pending';
COMMIT;

-- DropIndex
DROP INDEX "reading_feedback_user_id_idempotency_key_key";

-- AlterTable
ALTER TABLE "fulfillments" ADD COLUMN     "delivered_at" TIMESTAMPTZ(6),
ADD COLUMN     "shipped_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "reading_feedback" ADD COLUMN     "book_classification_version_id" UUID,
ADD COLUMN     "book_edition_id" UUID,
ADD COLUMN     "curation_assignment_id" UUID,
ADD COLUMN     "feedback_invitation_id" UUID,
ADD COLUMN     "fulfillment_id" UUID,
ADD COLUMN     "is_final" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "learning_status" "LearningStatus" NOT NULL DEFAULT 'pending_processing',
ADD COLUMN     "normalized_response" JSONB,
ADD COLUMN     "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processing_outcome" VARCHAR(40),
ADD COLUMN     "raw_response" JSONB;

-- CreateTable
CREATE TABLE "Author" (
    "id" UUID NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookAuthor" (
    "book_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "role" "AuthorRole" NOT NULL,

    CONSTRAINT "BookAuthor_pkey" PRIMARY KEY ("book_id","author_id","role")
);

-- CreateTable
CREATE TABLE "edition_contributors" (
    "id" UUID NOT NULL,
    "book_edition_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "role" "EditionContributorRole" NOT NULL,

    CONSTRAINT "edition_contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "canonical_title" TEXT NOT NULL,
    "original_language" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_editions" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "isbn" VARCHAR(13),
    "title" TEXT NOT NULL,
    "language_code" VARCHAR(8) NOT NULL,
    "format" TEXT NOT NULL,
    "pages" INTEGER,
    "publisher" TEXT,
    "publication_year" INTEGER,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_feature_definitions" (
    "feature_key" VARCHAR(100) NOT NULL,
    "schema_version" VARCHAR(30) NOT NULL,
    "scope" VARCHAR(10) NOT NULL,
    "value_semantics" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "book_feature_definitions_pkey" PRIMARY KEY ("feature_key","schema_version")
);

-- CreateTable
CREATE TABLE "content_type_definitions" (
    "content_type_key" VARCHAR(60) NOT NULL,
    "schema_version" VARCHAR(30) NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "content_type_definitions_pkey" PRIMARY KEY ("content_type_key","schema_version")
);

-- CreateTable
CREATE TABLE "book_feature_applicability" (
    "feature_key" VARCHAR(100) NOT NULL,
    "feature_schema_version" VARCHAR(30) NOT NULL,
    "content_type_key" VARCHAR(60) NOT NULL,
    "content_type_schema_version" VARCHAR(30) NOT NULL,
    "requirement" TEXT NOT NULL,

    CONSTRAINT "book_feature_applicability_pkey" PRIMARY KEY ("feature_key","feature_schema_version","content_type_key","content_type_schema_version")
);

-- CreateTable
CREATE TABLE "book_classification_versions" (
    "id" UUID NOT NULL,
    "book_edition_id" UUID NOT NULL,
    "content_type_key" VARCHAR(60) NOT NULL,
    "content_type_schema_version" VARCHAR(30) NOT NULL,
    "feature_schema_version" VARCHAR(30) NOT NULL,
    "tag_taxonomy_version" VARCHAR(30) NOT NULL,
    "revision" INTEGER NOT NULL,
    "classifier_version" VARCHAR(30) NOT NULL,
    "status" "ClassificationStatus" NOT NULL DEFAULT 'draft',
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "supersedes_id" UUID,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_classification_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_features" (
    "id" UUID NOT NULL,
    "classification_version_id" UUID NOT NULL,
    "feature_key" VARCHAR(100) NOT NULL,
    "value" DECIMAL(5,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "source" TEXT NOT NULL,
    "evidence_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "book_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_tags" (
    "id" UUID NOT NULL,
    "classification_version_id" UUID NOT NULL,
    "tag_key" VARCHAR(60) NOT NULL,
    "strength" DECIMAL(5,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "book_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curation_assignments" (
    "id" UUID NOT NULL,
    "fulfillment_id" UUID NOT NULL,
    "book_edition_id" UUID NOT NULL,
    "classification_version_id" UUID NOT NULL,
    "status" "SelectionStatus" NOT NULL DEFAULT 'active',
    "feedback_cycle_status" "FeedbackCycleStatus" NOT NULL DEFAULT 'not_invited',
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_by_id" UUID,
    "canceled_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "curation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_invitations" (
    "id" UUID NOT NULL,
    "curation_assignment_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "status" "FeedbackInvitationStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "feedback_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "edition_contributors_book_edition_id_author_id_role_key" ON "edition_contributors"("book_edition_id", "author_id", "role");

-- CreateIndex
CREATE INDEX "book_editions_book_id_idx" ON "book_editions"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_editions_id_book_id_key" ON "book_editions"("id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_classification_versions_book_edition_id_revision_key" ON "book_classification_versions"("book_edition_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "book_classification_versions_id_book_edition_id_key" ON "book_classification_versions"("id", "book_edition_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_features_classification_version_id_feature_key_key" ON "book_features"("classification_version_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "book_tags_classification_version_id_tag_key_key" ON "book_tags"("classification_version_id", "tag_key");

-- CreateIndex
CREATE INDEX "curation_assignments_fulfillment_id_idx" ON "curation_assignments"("fulfillment_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_invitations_token_hash_key" ON "feedback_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "feedback_invitations_curation_assignment_id_idx" ON "feedback_invitations"("curation_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_feedback_feedback_invitation_id_key" ON "reading_feedback"("feedback_invitation_id");

-- CreateIndex
CREATE INDEX "reading_feedback_curation_assignment_id_idx" ON "reading_feedback"("curation_assignment_id");

-- CreateIndex
CREATE INDEX "reading_feedback_learning_status_idx" ON "reading_feedback"("learning_status");

-- CreateIndex
CREATE INDEX "reading_feedback_user_id_learning_status_idx" ON "reading_feedback"("user_id", "learning_status");

-- Partial unique indexes (invariantes del plan)
CREATE UNIQUE INDEX "curation_assignments_one_active_per_fulfillment" ON "curation_assignments"("fulfillment_id") WHERE "status" = 'active';

CREATE UNIQUE INDEX "book_classification_versions_one_approved_per_edition" ON "book_classification_versions"("book_edition_id") WHERE "status" = 'approved';

CREATE UNIQUE INDEX "feedback_invitations_one_pending_per_assignment" ON "feedback_invitations"("curation_assignment_id") WHERE "status" = 'pending';

CREATE UNIQUE INDEX "book_editions_isbn_key" ON "book_editions"("isbn") WHERE "isbn" IS NOT NULL;

-- CHECK constraints
ALTER TABLE "book_features" ADD CONSTRAINT "book_features_value_range" CHECK ("value" BETWEEN 0 AND 1);
ALTER TABLE "book_features" ADD CONSTRAINT "book_features_confidence_range" CHECK ("confidence" BETWEEN 0 AND 0.95);
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_strength_range" CHECK ("strength" BETWEEN 0 AND 1);
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_confidence_range" CHECK ("confidence" BETWEEN 0 AND 0.95);

-- AddForeignKey
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_curation_assignment_id_fkey" FOREIGN KEY ("curation_assignment_id") REFERENCES "curation_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_book_edition_id_book_id_fkey" FOREIGN KEY ("book_edition_id", "book_id") REFERENCES "book_editions"("id", "book_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_book_classification_version_id_book_editi_fkey" FOREIGN KEY ("book_classification_version_id", "book_edition_id") REFERENCES "book_classification_versions"("id", "book_edition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_feedback_invitation_id_fkey" FOREIGN KEY ("feedback_invitation_id") REFERENCES "feedback_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAuthor" ADD CONSTRAINT "BookAuthor_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAuthor" ADD CONSTRAINT "BookAuthor_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition_contributors" ADD CONSTRAINT "edition_contributors_book_edition_id_fkey" FOREIGN KEY ("book_edition_id") REFERENCES "book_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition_contributors" ADD CONSTRAINT "edition_contributors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_editions" ADD CONSTRAINT "book_editions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_classification_versions" ADD CONSTRAINT "book_classification_versions_book_edition_id_fkey" FOREIGN KEY ("book_edition_id") REFERENCES "book_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_classification_versions" ADD CONSTRAINT "book_classification_versions_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "book_classification_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_features" ADD CONSTRAINT "book_features_classification_version_id_fkey" FOREIGN KEY ("classification_version_id") REFERENCES "book_classification_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_classification_version_id_fkey" FOREIGN KEY ("classification_version_id") REFERENCES "book_classification_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curation_assignments" ADD CONSTRAINT "curation_assignments_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curation_assignments" ADD CONSTRAINT "curation_assignments_book_edition_id_fkey" FOREIGN KEY ("book_edition_id") REFERENCES "book_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curation_assignments" ADD CONSTRAINT "curation_assignments_classification_version_id_book_editio_fkey" FOREIGN KEY ("classification_version_id", "book_edition_id") REFERENCES "book_classification_versions"("id", "book_edition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curation_assignments" ADD CONSTRAINT "curation_assignments_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "curation_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_invitations" ADD CONSTRAINT "feedback_invitations_curation_assignment_id_fkey" FOREIGN KEY ("curation_assignment_id") REFERENCES "curation_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
