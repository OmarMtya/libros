-- CreateTable
CREATE TABLE "reader_operational_constraints" (
    "profile_id" UUID NOT NULL,
    "preferred_pages_min" INTEGER,
    "preferred_pages_max" INTEGER,
    "series_preference" VARCHAR(60),
    "accepted_languages_json" JSONB NOT NULL DEFAULT '[]',
    "accepted_formats_json" JSONB NOT NULL DEFAULT '[]',
    "format_source" VARCHAR(60),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reader_operational_constraints_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "reader_conditional_rules" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "rule_key" VARCHAR(100) NOT NULL,
    "rule_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reader_conditional_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_positive_triggers" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "trigger_key" VARCHAR(100) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "total_evidence_weight" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reader_positive_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_positive_trigger_evidence" (
    "id" UUID NOT NULL,
    "trigger_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "base_weight" DECIMAL(5,4) NOT NULL,
    "exposure_factor" DECIMAL(5,4) NOT NULL,
    "specificity_factor" DECIMAL(5,4) NOT NULL,
    "attribution_factor" DECIMAL(5,4) NOT NULL,
    "final_weight" DECIMAL(5,4) NOT NULL,
    "reason_code" VARCHAR(100) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "evidence_fingerprint" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_positive_trigger_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reader_conditional_rules_profile_id_source_id_rule_key_key" ON "reader_conditional_rules"("profile_id", "source_id", "rule_key");

-- CreateIndex
CREATE UNIQUE INDEX "reader_positive_triggers_profile_id_trigger_key_key" ON "reader_positive_triggers"("profile_id", "trigger_key");

-- CreateIndex
CREATE UNIQUE INDEX "reader_positive_trigger_evidence_evidence_fingerprint_key" ON "reader_positive_trigger_evidence"("evidence_fingerprint");

-- CreateIndex
CREATE INDEX "reader_positive_trigger_evidence_trigger_id_idx" ON "reader_positive_trigger_evidence"("trigger_id");

-- AddForeignKey
ALTER TABLE "reader_operational_constraints" ADD CONSTRAINT "reader_operational_constraints_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_conditional_rules" ADD CONSTRAINT "reader_conditional_rules_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_positive_triggers" ADD CONSTRAINT "reader_positive_triggers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_positive_trigger_evidence" ADD CONSTRAINT "reader_positive_trigger_evidence_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "reader_positive_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
