import { EvidenceStatus, Prisma, PrismaClient } from '@prisma/client';
import { slowBurnCompensatorsRuleFor } from '../src/profile/conditional-rules';
import { aggregateDimension, evidenceFingerprint, round } from '../src/profile/profile-calculation';
import { ProfileService } from '../src/profile/profile.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DIAGNOSTIC_SESSION_ID = '0615ceb5-2cb9-4d03-bc84-53320cdf3d37';
const MAPPING_VERSION = 'onboarding/1.1';

type Mapping = {
  dimensionKey?: string;
  observedValue?: number;
  reasonCode: string;
  baseWeight: number;
  specificityFactor?: number;
  positiveTrigger?: string;
};

export async function migrateReaderProfile1_1(prisma: PrismaClient, sessionId = DIAGNOSTIC_SESSION_ID) {
  const session = await prisma.questionnaireSession.findUnique({
    where: { id: sessionId },
    include: { answers: true, user: { include: { readerProfile: true } } },
  });
  if (!session) throw new Error(`Questionnaire session ${sessionId} was not found.`);
  if (session.questionnaireVersion !== 'onboarding/1.0') throw new Error(`Expected onboarding/1.0, found ${session.questionnaireVersion}.`);
  if (!session.user.readerProfile) throw new Error(`User ${session.userId} does not have a reader profile.`);

  const profile = session.user.readerProfile;
  const answers = new Map(session.answers.map((answer) => [answer.questionKey, answer]));
  const questions = await Promise.all(['Q06_STYLE_FRAGMENT', 'Q10_EMOTIONAL_EXPERIENCE'].map((questionKey) => prisma.questionDefinition.findUniqueOrThrow({
    where: { questionKey_questionnaireVersion: { questionKey, questionnaireVersion: MAPPING_VERSION } },
    include: { optionMappings: { where: { isActive: true } } },
  })));
  const q06 = questions[0]!;
  const q10 = questions[1]!;

  const replacements = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    const q06Answer = answers.get('Q06_STYLE_FRAGMENT');
    if (q06Answer) {
      const optionKey = optionKeys(q06Answer.normalizedResponse)[0];
      const option = q06.optionMappings.find((item) => item.optionKey === optionKey);
      if (option && optionKey) {
        const created = await createEvidence(tx, profile.id, session.userId, q06Answer.id, 'Q06_STYLE_FRAGMENT', optionKey, q06Answer.normalizedResponse, option.evidenceMappingsJson as Mapping[]);
        const density = created.find((item) => item.dimensionKey === 'descriptive_density_preference');
        if (density) replacements.set('q06_atmosphere_description', density.id);
      }
    }

    const q10Answer = answers.get('Q10_EMOTIONAL_EXPERIENCE');
    if (q10Answer) {
      for (const optionKey of optionKeys(q10Answer.normalizedResponse)) {
        const option = q10.optionMappings.find((item) => item.optionKey === optionKey);
        if (!option) continue;
        const mappings = option.evidenceMappingsJson as Mapping[];
        const created = optionKey === 'tension' ? [] : await createEvidence(tx, profile.id, session.userId, q10Answer.id, 'Q10_EMOTIONAL_EXPERIENCE', optionKey, q10Answer.normalizedResponse, mappings);
        if (optionKey === 'reflection') {
          const conceptual = created.find((item) => item.dimensionKey === 'conceptual_depth_appreciation');
          if (conceptual) replacements.set('q10_emotion_reflection_ideas', conceptual.id);
        }
        await createPositiveTriggers(tx, profile.id, q10Answer.id, optionKey, q10Answer.normalizedResponse, mappings);
      }
    }

    await tx.readerEvidence.updateMany({
      where: { profileId: profile.id, status: EvidenceStatus.active, reasonCode: { in: ['q06_atmosphere_description', 'q10_emotion_curiosity', 'q10_emotion_reflection', 'q10_emotion_reflection_ideas'] } },
      data: { status: EvidenceStatus.superseded },
    });
    for (const [reasonCode, supersededById] of replacements) {
      await tx.readerEvidence.updateMany({ where: { profileId: profile.id, reasonCode, status: EvidenceStatus.superseded }, data: { supersededById } });
    }

    const q05aAnswer = answers.get('Q05A_SLOW_BURN_CONDITIONS');
    if (q05aAnswer) {
      const selected = optionKeys(q05aAnswer.normalizedResponse);
      const rule = slowBurnCompensatorsRuleFor(selected);
      await tx.readerConditionalRule.upsert({
        where: { profileId_sourceId_ruleKey: { profileId: profile.id, sourceId: q05aAnswer.id, ruleKey: rule.rule_key } },
        create: { profileId: profile.id, sourceId: q05aAnswer.id, ruleKey: rule.rule_key, ruleJson: rule as Prisma.InputJsonValue },
        update: {},
      });
    }

    const q12Answer = answers.get('Q12_LENGTH_SERIES');
    const q13Answer = answers.get('Q13_FORMAT_LANGUAGE');
    if (q12Answer || q13Answer) {
      const q12Response = q12Answer?.normalizedResponse as Record<string, unknown> | undefined;
      const q13Response = q13Answer?.normalizedResponse as Record<string, unknown> | undefined;
      const languages = stringArray(q13Response?.languages).map((language) => language === 'spanish' ? 'es' : language === 'english' ? 'en' : language).filter((language) => language === 'es' || language === 'en');
      await tx.readerOperationalConstraints.upsert({
        where: { profileId: profile.id },
        create: { profileId: profile.id, preferredPagesMin: numberValue(q12Response?.minPages), preferredPagesMax: numberValue(q12Response?.maxPages), seriesPreference: stringValue(q12Response?.seriesPreference), acceptedLanguagesJson: languages, acceptedFormatsJson: ['physical'], formatSource: 'product_default' },
        update: { preferredPagesMin: numberValue(q12Response?.minPages), preferredPagesMax: numberValue(q12Response?.maxPages), seriesPreference: stringValue(q12Response?.seriesPreference), acceptedLanguagesJson: languages, acceptedFormatsJson: ['physical'], formatSource: 'product_default' },
      });
    }

    // The historical curiosity-to-mystery inference is not valid under onboarding/1.1.
    await tx.readerTagPreference.deleteMany({ where: { profileId: profile.id, tagKey: 'mystery' } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const result = await new ProfileService(prisma as unknown as PrismaService).recompute(session.userId, 'onboarding_1_1_migration', session.id);
  return { profile: result.profile, profileVersionCreated: result.created };
}

async function createEvidence(tx: Prisma.TransactionClient, profileId: string, userId: string, sourceId: string, questionKey: string, optionKey: string, normalizedResponse: unknown, mappings: Mapping[]) {
  const result = [] as Array<{ id: string; dimensionKey: string }>;
  for (const mapping of mappings) {
    if (!mapping.dimensionKey || mapping.observedValue === undefined) continue;
    const rawPayload = { mapping_version: MAPPING_VERSION, question_key: questionKey, option_key: optionKey, normalized_response: normalizedResponse };
    const finalWeight = round(mapping.baseWeight * (mapping.specificityFactor ?? 1));
    const fingerprint = evidenceFingerprint(sourceId, mapping.dimensionKey, mapping.reasonCode, mapping.observedValue, rawPayload);
    const evidence = await tx.readerEvidence.upsert({
      where: { evidenceFingerprint: fingerprint },
      create: { userId, profileId, sourceType: 'questionnaire_answer', sourceId, dimensionKey: mapping.dimensionKey, observedValue: mapping.observedValue, direction: 1, baseWeight: mapping.baseWeight, exposureFactor: 1, specificityFactor: mapping.specificityFactor ?? 1, attributionFactor: 1, finalWeight, reasonCode: mapping.reasonCode, rawPayload: rawPayload as Prisma.InputJsonValue, evidenceFingerprint: fingerprint },
      update: {},
    });
    result.push({ id: evidence.id, dimensionKey: evidence.dimensionKey });
  }
  return result;
}

async function createPositiveTriggers(tx: Prisma.TransactionClient, profileId: string, sourceId: string, optionKey: string, normalizedResponse: unknown, mappings: Mapping[]) {
  for (const mapping of mappings) {
    if (!mapping.positiveTrigger) continue;
    const trigger = await tx.readerPositiveTrigger.upsert({ where: { profileId_triggerKey: { profileId, triggerKey: mapping.positiveTrigger } }, create: { profileId, triggerKey: mapping.positiveTrigger }, update: {} });
    const rawPayload = { mapping_version: MAPPING_VERSION, question_key: 'Q10_EMOTIONAL_EXPERIENCE', option_key: optionKey, normalized_response: normalizedResponse };
    const finalWeight = round(mapping.baseWeight * (mapping.specificityFactor ?? 1));
    const fingerprint = evidenceFingerprint(sourceId, mapping.positiveTrigger, mapping.reasonCode, 1, rawPayload);
    await tx.readerPositiveTriggerEvidence.upsert({
      where: { evidenceFingerprint: fingerprint },
      create: { triggerId: trigger.id, sourceId, baseWeight: mapping.baseWeight, exposureFactor: 1, specificityFactor: mapping.specificityFactor ?? 1, attributionFactor: 1, finalWeight, reasonCode: mapping.reasonCode, rawPayload: rawPayload as Prisma.InputJsonValue, evidenceFingerprint: fingerprint },
      update: {},
    });
    const evidence = await tx.readerPositiveTriggerEvidence.findMany({ where: { triggerId: trigger.id } });
    const aggregate = aggregateDimension(evidence.map((item) => ({ dimensionKey: mapping.positiveTrigger!, observedValue: 1, finalWeight: item.finalWeight, sourceType: 'questionnaire_answer', sourceId: item.sourceId, createdAt: item.createdAt })));
    await tx.readerPositiveTrigger.update({ where: { id: trigger.id }, data: { confidence: aggregate.confidence, evidenceCount: aggregate.evidenceCount, totalEvidenceWeight: aggregate.totalEvidenceWeight } });
  }
}

function optionKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const optionKeys = (value as Record<string, unknown>).optionKeys;
  return Array.isArray(optionKeys) ? optionKeys.filter((item): item is string => typeof item === 'string') : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

if (process.argv[1]?.endsWith('migrate-reader-profile-1-1.ts')) {
  const prisma = new PrismaClient();
  migrateReaderProfile1_1(prisma)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .finally(() => prisma.$disconnect());
}
