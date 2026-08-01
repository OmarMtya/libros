-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('scored', 'selected');

-- CreateEnum
CREATE TYPE "TagEvidenceSourceType" AS ENUM ('questionnaire', 'reading_feedback');

-- CreateEnum
CREATE TYPE "CandidateReviewStatus" AS ENUM ('eligible', 'blocked', 'needs_classification');

-- AlterTable
ALTER TABLE "curation_assignments" ADD COLUMN     "recommendation_candidate_id" UUID;

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "fulfillment_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "profile_version" INTEGER NOT NULL,
    "package_key" "ProductPackageKey" NOT NULL,
    "context_json" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'scored',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "scored_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_candidates" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "book_edition_id" UUID NOT NULL,
    "classification_version_id" UUID NOT NULL,
    "rank_position" INTEGER,
    "review_status" "CandidateReviewStatus" NOT NULL DEFAULT 'eligible',
    "block_reason" TEXT,
    "numeric_fit_score" DECIMAL(5,4),
    "coverage_ratio" DECIMAL(5,4),
    "tag_fit_score" DECIMAL(5,4),
    "tag_fit_raw" DECIMAL(8,4),
    "tag_fit_scale" DECIMAL(8,4),
    "context_fit_score" DECIMAL(5,4),
    "context_length_fit" DECIMAL(5,4),
    "context_reading_time_fit" DECIMAL(5,4),
    "context_goal_fit" DECIMAL(5,4),
    "context_emotion_fit" DECIMAL(5,4),
    "context_effort_fit" DECIMAL(5,4),
    "discovery_fit_score" DECIMAL(5,4),
    "scoring_minimum_confidence_factor" DECIMAL(5,4),
    "risk_penalty" DECIMAL(5,4),
    "risk_penalty_breakdown_json" JSONB NOT NULL,
    "final_score" DECIMAL(5,4),
    "recommendation_evidence_coverage" DECIMAL(5,4),
    "weight_distribution_json" JSONB NOT NULL,
    "evaluation_meta_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_tag_evidence" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "source_type" "TagEvidenceSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "feedback_id" UUID,
    "book_id" UUID,
    "book_edition_id" UUID,
    "book_classification_version_id" UUID,
    "tag_key" VARCHAR(60) NOT NULL,
    "adjustment" DECIMAL(5,4) NOT NULL,
    "direction" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "base_weight" DECIMAL(5,4) NOT NULL,
    "final_weight" DECIMAL(5,4) NOT NULL,
    "reason_code" VARCHAR(100) NOT NULL,
    "mapping_version" VARCHAR(30) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "evidence_fingerprint" VARCHAR(64) NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_tag_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curator_action_audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_role" VARCHAR(30) NOT NULL,
    "action_kind" VARCHAR(60) NOT NULL,
    "target_type" VARCHAR(60) NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "payload_diff_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curator_action_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendations_user_id_idx" ON "recommendations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_fulfillment_id_revision_key" ON "recommendations"("fulfillment_id", "revision");

-- CreateIndex
CREATE INDEX "recommendation_candidates_recommendation_id_rank_position_idx" ON "recommendation_candidates"("recommendation_id", "rank_position");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_candidates_recommendation_id_classification__key" ON "recommendation_candidates"("recommendation_id", "classification_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "reader_tag_evidence_evidence_fingerprint_key" ON "reader_tag_evidence"("evidence_fingerprint");

-- CreateIndex
CREATE INDEX "reader_tag_evidence_profile_id_status_idx" ON "reader_tag_evidence"("profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reader_tag_evidence_source_type_source_id_tag_key_reason_co_key" ON "reader_tag_evidence"("source_type", "source_id", "tag_key", "reason_code");

-- CreateIndex
CREATE INDEX "curator_action_audit_target_type_target_id_idx" ON "curator_action_audit"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "curation_assignments_recommendation_candidate_id_key" ON "curation_assignments"("recommendation_candidate_id");

-- AddForeignKey
ALTER TABLE "curation_assignments" ADD CONSTRAINT "curation_assignments_recommendation_candidate_id_fkey" FOREIGN KEY ("recommendation_candidate_id") REFERENCES "recommendation_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_candidates" ADD CONSTRAINT "recommendation_candidates_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_candidates" ADD CONSTRAINT "recommendation_candidates_book_edition_id_fkey" FOREIGN KEY ("book_edition_id") REFERENCES "book_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_candidates" ADD CONSTRAINT "recommendation_candidates_classification_version_id_book_e_fkey" FOREIGN KEY ("classification_version_id", "book_edition_id") REFERENCES "book_classification_versions"("id", "book_edition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_tag_evidence" ADD CONSTRAINT "reader_tag_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_tag_evidence" ADD CONSTRAINT "reader_tag_evidence_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_tag_evidence" ADD CONSTRAINT "reader_tag_evidence_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "reading_feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index (invariante del plan): una sola revision actual por fulfillment
CREATE UNIQUE INDEX "recommendations_one_current_per_fulfillment" ON "recommendations"("fulfillment_id") WHERE "is_current" = true;
