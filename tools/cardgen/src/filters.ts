const UNSTABLE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(currently|presently|nowadays|as of (today|now))\b/i, reason: 'present-tense claim' },
  { pattern: /\b(today|this year|last year|recent(ly)?|latest|newest)\b/i, reason: 'relative time' },
  { pattern: /\bthe (most|least) recent\b/i, reason: 'relative time' },
  { pattern: /\b(record|world record)\b/i, reason: 'records change' },
  { pattern: /\bthe only\b/i, reason: 'uniqueness claims decay' },
  { pattern: /\b(largest|biggest|smallest|tallest|longest|highest|richest|fastest)\b/i, reason: 'superlative' },
  { pattern: /\b(so far|to date|up to now|still)\b/i, reason: 'open-ended' },
  { pattern: /\bwho is the (current|reigning)\b/i, reason: 'office holder' },
  { pattern: /\b(20[2-9]\d)\b/, reason: 'recent year' },
];

export interface StabilityVerdict {
  stable: boolean;
  reasons: string[];
}

export function checkStability(text: string): StabilityVerdict {
  const reasons = UNSTABLE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ reason }) => reason,
  );
  return { stable: reasons.length === 0, reasons: [...new Set(reasons)] };
}


const UNCONVERTIBLE = [
  /which of the following/i,
  /which of these/i,
  /all of the above/i,
  /none of the above/i,
  /^which one/i,
  /the following/i,
  /\bthis (image|picture|logo)\b/i,
];

export function isConvertible(question: string): boolean {
  return !UNCONVERTIBLE.some((pattern) => pattern.test(question));
}

const SENSITIVE = [
  /\b(rumou?r|allegedly|reportedly|is said to)\b/i,
  /\b(scandal|affair|arrested|convicted|lawsuit)\b/i,
];

export function isSensitive(text: string): boolean {
  return SENSITIVE.some((pattern) => pattern.test(text));
}
