/**
 * Run record schema `agent-compare.run/v2`.
 *
 * Every field states a fact the code observed. Anything it could not observe is
 * left `undefined` or carries an explicit `unknown` marker; it is never zero-filled.
 * Records of an older schema are read-only history: nothing acts on their
 * recorded paths or process ids.
 */
export const RUN_SCHEMA = 'agent-compare.run/v2';
export const RUN_COORDINATION = 'sqlite-run/v1';
export const LEGACY_SCHEMAS = ['agent-compare.run/v1'];
/** A comparison has 2–4 candidates, labelled in order. */
export const CANDIDATE_LABELS = ['A', 'B', 'C', 'D'];
export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 4;
/** Why a version was picked, in the user's own words: fixed choices plus a short note. */
export const PICK_REASONS = ['layout', 'look', 'interaction', 'wording', 'complete', 'robust', 'simple', 'fast'];
export const MAX_PICK_NOTE = 120;
