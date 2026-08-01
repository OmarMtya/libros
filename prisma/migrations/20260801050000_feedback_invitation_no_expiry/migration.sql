-- Las invitaciones de feedback ya no caducan: expires_at nullable = sin expiración.
ALTER TABLE "feedback_invitations" ALTER COLUMN "expires_at" DROP NOT NULL;
