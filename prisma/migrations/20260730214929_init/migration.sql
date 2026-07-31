-- CreateEnum
CREATE TYPE "DimensionKind" AS ENUM ('target', 'minimum_required', 'maximum_tolerated', 'importance', 'selection_control');

-- CreateEnum
CREATE TYPE "MatchingOperator" AS ENUM ('absolute_distance', 'minimum_threshold', 'maximum_threshold', 'selection_control');

-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('scale', 'single_select', 'multi_select', 'ranking', 'structured', 'book_search');

-- CreateEnum
CREATE TYPE "QuestionnaireStatus" AS ENUM ('started', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('questionnaire_answer', 'reading_feedback', 'ai_proposal');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('active', 'superseded', 'rejected', 'deactivated');

-- CreateEnum
CREATE TYPE "FeedbackReadingStatus" AS ENUM ('completed', 'in_progress', 'paused', 'abandoned', 'not_started');

-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('genre', 'subgenre', 'theme', 'setting', 'period', 'cultural_context', 'narrative_motif');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('active', 'deprecated');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_definitions" (
    "key" VARCHAR(100) NOT NULL,
    "domain_key" VARCHAR(100) NOT NULL,
    "dimension_kind" "DimensionKind" NOT NULL,
    "book_feature_key" VARCHAR(100),
    "matching_operator" "MatchingOperator" NOT NULL,
    "lower_label" TEXT NOT NULL,
    "upper_label" TEXT NOT NULL,
    "schema_version" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dimension_definitions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "question_definitions" (
    "id" UUID NOT NULL,
    "question_key" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL,
    "questionnaire_version" VARCHAR(30) NOT NULL,
    "text_es_mx" TEXT NOT NULL,
    "response_type" "ResponseType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL,
    "branching_rules_json" JSONB,
    "validation_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_option_mappings" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "option_key" VARCHAR(100) NOT NULL,
    "label_es_mx" TEXT NOT NULL,
    "evidence_mappings_json" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "question_option_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "questionnaire_version" VARCHAR(30) NOT NULL,
    "status" "QuestionnaireStatus" NOT NULL DEFAULT 'started',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "questionnaire_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_answers" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_key" VARCHAR(100) NOT NULL,
    "question_version" INTEGER NOT NULL,
    "questionnaire_version" VARCHAR(30) NOT NULL,
    "stimulus_hash" VARCHAR(64),
    "raw_response" JSONB NOT NULL,
    "normalized_response" JSONB NOT NULL,
    "idempotency_key" VARCHAR(100),
    "answered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "schema_version" VARCHAR(30) NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "overall_confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "global_profile_coverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "onboarding_core_coverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidence_maturity" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "ready_to_recommend" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "snapshot_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reader_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_profile_dimensions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "dimension_key" VARCHAR(100) NOT NULL,
    "value" DECIMAL(5,4),
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "total_evidence_weight" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "last_evidence_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reader_profile_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_profile_versions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "change_reason" VARCHAR(100) NOT NULL,
    "source_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_evidence" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "book_id" UUID,
    "source_type" "EvidenceSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "dimension_key" VARCHAR(100) NOT NULL,
    "observed_value" DECIMAL(5,4) NOT NULL,
    "direction" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "base_weight" DECIMAL(5,4) NOT NULL,
    "exposure_factor" DECIMAL(5,4) NOT NULL,
    "specificity_factor" DECIMAL(5,4) NOT NULL,
    "attribution_factor" DECIMAL(5,4) NOT NULL,
    "final_weight" DECIMAL(5,4) NOT NULL,
    "reason_code" VARCHAR(100) NOT NULL,
    "reason_text" TEXT,
    "raw_payload" JSONB NOT NULL,
    "evidence_fingerprint" VARCHAR(64) NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'active',
    "superseded_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_version_evidence" (
    "profile_version_id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "included_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_version_evidence_pkey" PRIMARY KEY ("profile_version_id","evidence_id")
);

-- CreateTable
CREATE TABLE "tag_identity" (
    "tag_key" VARCHAR(60) NOT NULL,
    "canonical_taxonomic_version" VARCHAR(20) NOT NULL,
    "current_status" "TagStatus" NOT NULL,
    "current_replacement_tag_key" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_identity_pkey" PRIMARY KEY ("tag_key")
);

-- CreateTable
CREATE TABLE "tag_versions" (
    "tag_key" VARCHAR(60) NOT NULL,
    "taxonomic_version" VARCHAR(20) NOT NULL,
    "tag_type" "TagType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(280) NOT NULL,
    "aliases_json" JSONB NOT NULL,
    "parent_tag_key" VARCHAR(60),
    "status" "TagStatus" NOT NULL,
    "replacement_tag_key" VARCHAR(60),
    "replacement_tag_keys_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecated_at" TIMESTAMPTZ(6),
    "deprecated_reason" TEXT,

    CONSTRAINT "tag_versions_pkey" PRIMARY KEY ("tag_key","taxonomic_version")
);

-- CreateTable
CREATE TABLE "reader_tag_preferences" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "tag_key" VARCHAR(60) NOT NULL,
    "tag_type" "TagType" NOT NULL,
    "affinity" DECIMAL(5,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reader_tag_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID,
    "recommendation_id" UUID,
    "feedback_version" VARCHAR(30) NOT NULL,
    "started" BOOLEAN NOT NULL,
    "reading_status" "FeedbackReadingStatus" NOT NULL,
    "completion_percentage" INTEGER NOT NULL,
    "selection_fit_rating" INTEGER,
    "outcome_attribution" VARCHAR(40),
    "next_direction_json" JSONB,
    "free_text" TEXT,
    "idempotency_key" VARCHAR(100),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_feedback_aspects" (
    "id" UUID NOT NULL,
    "feedback_id" UUID NOT NULL,
    "polarity" VARCHAR(10) NOT NULL,
    "option_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_feedback_aspects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_definitions_question_key_version_key" ON "question_definitions"("question_key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "question_definitions_question_key_questionnaire_version_key" ON "question_definitions"("question_key", "questionnaire_version");

-- CreateIndex
CREATE UNIQUE INDEX "question_option_mappings_question_id_option_key_key" ON "question_option_mappings"("question_id", "option_key");

-- CreateIndex
CREATE INDEX "questionnaire_sessions_user_id_status_idx" ON "questionnaire_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "question_answers_question_key_question_version_idx" ON "question_answers"("question_key", "question_version");

-- CreateIndex
CREATE UNIQUE INDEX "question_answers_session_id_question_key_key" ON "question_answers"("session_id", "question_key");

-- CreateIndex
CREATE UNIQUE INDEX "question_answers_session_id_idempotency_key_key" ON "question_answers"("session_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "reader_profiles_user_id_key" ON "reader_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reader_profile_dimensions_profile_id_dimension_key_key" ON "reader_profile_dimensions"("profile_id", "dimension_key");

-- CreateIndex
CREATE UNIQUE INDEX "reader_profile_versions_profile_id_version_key" ON "reader_profile_versions"("profile_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "reader_evidence_evidence_fingerprint_key" ON "reader_evidence"("evidence_fingerprint");

-- CreateIndex
CREATE INDEX "reader_evidence_user_id_status_idx" ON "reader_evidence"("user_id", "status");

-- CreateIndex
CREATE INDEX "reader_evidence_profile_id_status_idx" ON "reader_evidence"("profile_id", "status");

-- CreateIndex
CREATE INDEX "tag_versions_tag_type_status_taxonomic_version_idx" ON "tag_versions"("tag_type", "status", "taxonomic_version");

-- CreateIndex
CREATE UNIQUE INDEX "reader_tag_preferences_profile_id_tag_key_key" ON "reader_tag_preferences"("profile_id", "tag_key");

-- CreateIndex
CREATE UNIQUE INDEX "reading_feedback_user_id_idempotency_key_key" ON "reading_feedback"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "reading_feedback_aspects_feedback_id_polarity_option_key_key" ON "reading_feedback_aspects"("feedback_id", "polarity", "option_key");

-- AddForeignKey
ALTER TABLE "question_option_mappings" ADD CONSTRAINT "question_option_mappings_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_sessions" ADD CONSTRAINT "questionnaire_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "questionnaire_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_profiles" ADD CONSTRAINT "reader_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_profile_dimensions" ADD CONSTRAINT "reader_profile_dimensions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_profile_dimensions" ADD CONSTRAINT "reader_profile_dimensions_dimension_key_fkey" FOREIGN KEY ("dimension_key") REFERENCES "dimension_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_profile_versions" ADD CONSTRAINT "reader_profile_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_evidence" ADD CONSTRAINT "reader_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_evidence" ADD CONSTRAINT "reader_evidence_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_evidence" ADD CONSTRAINT "reader_evidence_dimension_key_fkey" FOREIGN KEY ("dimension_key") REFERENCES "dimension_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_evidence" ADD CONSTRAINT "reader_evidence_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "reader_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_version_evidence" ADD CONSTRAINT "profile_version_evidence_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "reader_profile_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_version_evidence" ADD CONSTRAINT "profile_version_evidence_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "reader_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_versions" ADD CONSTRAINT "tag_versions_tag_key_fkey" FOREIGN KEY ("tag_key") REFERENCES "tag_identity"("tag_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_tag_preferences" ADD CONSTRAINT "reader_tag_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_tag_preferences" ADD CONSTRAINT "reader_tag_preferences_tag_key_fkey" FOREIGN KEY ("tag_key") REFERENCES "tag_identity"("tag_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_feedback" ADD CONSTRAINT "reading_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_feedback_aspects" ADD CONSTRAINT "reading_feedback_aspects_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "reading_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
