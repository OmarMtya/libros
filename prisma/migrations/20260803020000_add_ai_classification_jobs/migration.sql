-- CreateTable
CREATE TABLE "ai_classification_jobs" (
    "id" UUID NOT NULL,
    "classification_version_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_markdown" TEXT,
    "proposal_json" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ai_classification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_classification_jobs_status_created_at_idx" ON "ai_classification_jobs"("status", "created_at");

-- AddForeignKey
ALTER TABLE "ai_classification_jobs" ADD CONSTRAINT "ai_classification_jobs_classification_version_id_fkey" FOREIGN KEY ("classification_version_id") REFERENCES "book_classification_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
