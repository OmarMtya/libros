import Decimal from 'decimal.js';
import { createHash } from 'node:crypto';

export type EvidenceForCalculation = {
  dimensionKey: string;
  observedValue: Decimal.Value;
  finalWeight: Decimal.Value;
  sourceType: 'questionnaire_answer' | 'reading_feedback' | 'ai_proposal';
  sourceId: string;
  createdAt: Date;
};

export type AggregatedDimension = {
  value: Decimal | null;
  confidence: Decimal;
  evidenceCount: number;
  totalEvidenceWeight: Decimal;
  lastEvidenceAt: Date | null;
};

export function round(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function aggregateDimension(evidence: EvidenceForCalculation[]): AggregatedDimension {
  if (evidence.length === 0) {
    return { value: null, confidence: new Decimal(0), evidenceCount: 0, totalEvidenceWeight: new Decimal(0), lastEvidenceAt: null };
  }

  const totalWeight = evidence.reduce((sum, item) => sum.plus(item.finalWeight), new Decimal(0));
  const value = evidence.reduce((sum, item) => sum.plus(new Decimal(item.finalWeight).mul(item.observedValue)), new Decimal(0)).div(totalWeight);
  const variance = evidence.reduce((sum, item) => {
    return sum.plus(new Decimal(item.finalWeight).mul(new Decimal(item.observedValue).minus(value).pow(2)));
  }, new Decimal(0)).div(totalWeight);
  const consistency = Decimal.max(0, Decimal.min(1, new Decimal(1).minus(variance.div(0.25))));
  const maturity = new Decimal(1).minus(new Decimal(-1).mul(totalWeight).div(3).exp());
  let confidence = maturity.mul(new Decimal(0.4).plus(new Decimal(0.6).mul(consistency)));
  const feedbackSources = new Set(evidence.filter((item) => item.sourceType === 'reading_feedback').map((item) => item.sourceId));
  confidence = Decimal.min(confidence, feedbackSources.size >= 3 ? 0.95 : feedbackSources.size > 0 ? 0.85 : 0.55);

  return {
    value: round(value),
    confidence: round(confidence),
    evidenceCount: evidence.length,
    totalEvidenceWeight: round(totalWeight),
    lastEvidenceAt: evidence.reduce<Date>((latest, item) => item.createdAt > latest ? item.createdAt : latest, evidence[0]!.createdAt),
  };
}

export function evidenceSetHash(fingerprints: string[]): string {
  return createHash('sha256').update([...fingerprints].sort().join(''), 'utf8').digest('hex');
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function evidenceFingerprint(sourceId: string, dimensionKey: string, reasonCode: string, observedValue: Decimal.Value, rawPayload: unknown): string {
  return createHash('sha256')
    .update([sourceId, dimensionKey, reasonCode, new Decimal(observedValue).toFixed(4), canonicalJson(rawPayload)].join('|'), 'utf8')
    .digest('hex');
}
