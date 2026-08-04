import { describe, expect, it } from 'vitest';
import { buildProfileDescriptionPrompt } from '../src/profile/ai-description.prompt';

const SAMPLE = {
  displayName: 'Ana García',
  priorityRanking: ['characters', 'plot', 'emotion'],
  dimensions: [
    { key: 'ornate_prose_tolerance', value: 0.2, confidence: 0.9 },
    { key: 'character_depth_need', value: 0.9, confidence: 0.85 },
    { key: 'pace_preference', value: null, confidence: 0.05 },
  ],
  tagPreferences: [
    { tagKey: 'science_fiction', name: 'Ciencia ficción', affinity: 0.8 },
    { tagKey: 'literary_fiction', name: 'Novela literaria', affinity: -0.4 },
  ],
  constraints: {
    preferredPagesMin: 150,
    preferredPagesMax: 350,
    seriesPreference: 'standalone_preferred',
    acceptedLanguages: ['es', 'en'],
    acceptedFormats: ['physical'],
  },
  lovedBooks: [{ title: 'Harry Potter', authors: ['J. K. Rowling'] }],
  dislikedBooks: [{ title: 'Ulysses', authors: ['James Joyce'] }],
};

describe('ai-description prompt', () => {
  it('includes the human glossary and the subject\'s name', () => {
    const { system, user } = buildProfileDescriptionPrompt(SAMPLE);
    expect(system).toContain('ornate_prose_tolerance');
    expect(system).toContain('400 caracteres');
    expect(user).toContain('Ana García');
  });

  it('includes priority ranking, dimensions, tags, constraints and books', () => {
    const { user } = buildProfileDescriptionPrompt(SAMPLE);
    expect(user).toContain('personajes → trama → emoción');
    expect(user).toContain('valor 0.20');
    expect(user).toContain('Ciencia ficción');
    expect(user).toContain('Novela literaria');
    expect(user).toContain('entre 150 y 350 páginas');
    expect(user).toContain('Harry Potter');
    expect(user).toContain('Ulysses');
  });

  it('omits dimensions without data and filters low-confidence values', () => {
    const { user } = buildProfileDescriptionPrompt(SAMPLE);
    expect(user).not.toContain('pace_preference');
  });

  it('forbids technical language and asks for a subjective paragraph', () => {
    const { system } = buildProfileDescriptionPrompt(SAMPLE);
    expect(system).toMatch(/NUNCA uses números/);
    expect(system).toContain('confidence');
    expect(system).toContain('según su perfil');
  });
});
