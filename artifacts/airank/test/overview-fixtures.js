export const metrics = (overrides = {}) => ({
  state: 'partial', eligible: 3, expected: 5, classified: 2,
  mentions: 1, recommended: 1, ownedCitations: 0,
  visibility: 33.3, recommendationRate: 50, citationRate: 0,
  cohortShare: null, score: 3.3, positions: 1, meanPosition: 2,
  brandOrder: { version: 'tracked-literal-first-mention-v1', scope: 'tracked_cohort',
    eligibleAnswers: 3, mentionedAnswers: 1, firsts: 0, meanPosition: 2,
    winRate: 0, ambiguousAnswers: 0, unavailableAnswers: 0 },
  ...overrides,
});

const evidence = (id, overrides = {}) => ({
  id, runId: 'older', promptId: `prompt-${id}`, text: `Prompt ${id}`, topic: 'Discovery', tags: [], brandNames: [], promptVersion: 1, provider: 'OpenAI', model: 'model-fixture',
  observedAt: Date.parse('2026-10-12T10:00:00Z'), status: 'success',
  exclusion: null, mentioned: false, recommendation: 'unknown',
  ownedCitation: false, position: null, recommendationSpans: [],
  answer: `Original answer ${id}`, citations: [], ...overrides,
});

export { evidence };
export const analyticsFixture = () => ({
  market: 'FI', language: 'sv', totalRuns: 2, quickChecks: 0,
  selectedGroup: 'group-a', groups: [{ id: 'group-a', runCount: 2 }],
  availableProviders: ['OpenAI', 'Gemini'], topics: ['Discovery', 'Pricing'],
  metrics: metrics(),
  providers: [
    { provider: 'OpenAI', metrics: metrics() },
    { provider: 'Gemini', metrics: metrics({
      state: 'unavailable', eligible: 0, expected: 2, visibility: null,
      recommendationRate: null, citationRate: null, score: null, meanPosition: null,
    }) },
  ],
  runs: [
    { id: 'older', group: 'group-a', kind: 'monitoring', status: 'completed', createdAt: 1791712800, metrics: metrics() },
    { id: 'diagnostic', group: 'group-a', kind: 'diagnostic', status: 'completed', createdAt: Date.parse('2026-10-14T11:00:00Z'), metrics: metrics() },
    { id: 'partial', group: 'group-a', kind: 'monitoring', status: 'partial', createdAt: Date.parse('2026-10-12T10:00:00Z'), metrics: metrics() },
    { id: 'failed', group: 'group-a', kind: 'monitoring', status: 'failed', createdAt: Date.parse('2026-10-14T12:00:00Z'), metrics: metrics() },
    { id: 'running', group: 'group-a', kind: 'monitoring', status: 'running', createdAt: Date.parse('2026-10-14T13:00:00Z'), metrics: metrics() },
  ],
  competitors: [],
  overview: {
    matrix: [{ topic: 'Discovery', tag: '', metrics: metrics() }, { topic: 'Pricing', tag: 'commercial', metrics: metrics({ visibility: 0, mentions: 0 }) }],
    domains: [{ domain: 'kahvila.fi', category: 'owned', answers: 2 }, { domain: 'rival.fi', category: 'competitor', answers: 1 }],
    domainTypes: [{ category: 'owned', answers: 2 }, { category: 'competitor', answers: 1 }],
    comparison: { from: '2026-09-17', to: '2026-10-14', metrics: metrics({ visibility: 30, recommendationRate: 55 }) },
  },
  evidence: [
    evidence('mention', { mentioned: true, position: 2, answer: 'Rival, then Kahvila', brandNames: ['Rival', 'Kahvila'], brandOrder: {
      version: 'tracked-literal-first-mention-v1', scope: 'tracked_cohort', state: 'observed', reason: null,
      targetPosition: 2, mentions: [{ brandName: 'Rival', quote: 'Rival', start: 0, end: 5, position: 1 }, { brandName: 'Kahvila', quote: 'Kahvila', start: 12, end: 19, position: 2 }],
    } }),
    evidence('recommendation', { recommendation: 'recommended' }),
    evidence('citation', { ownedCitation: true }),
    evidence('span-only', { recommendationSpans: ['Recommended in text, not classified'] }),
    evidence('excluded', { exclusion: 'timeout', mentioned: true, recommendation: 'recommended', ownedCitation: true }),
  ],
});
