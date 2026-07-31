export type AiEvidenceProposal = {
  schemaVersion: 'ai-evidence-proposal/1.0';
  sourceId: string;
  proposedEvidence: Array<{ dimensionKey: string; observedValue: number; reasonCode: string; supportingExcerpt: string }>;
  needsHumanReview: boolean;
  ambiguities: string[];
};

export interface AiEvidenceProposerPort {
  proposeFromFeedback(input: { feedbackId: string; text: string }): Promise<AiEvidenceProposal>;
}

export const AI_EVIDENCE_PROPOSER = Symbol('AI_EVIDENCE_PROPOSER');
