const INJECTION_PATTERNS: readonly string[] = [
  'ignore previous',
  'ignore all previous',
  'disregard the above',
  'disregard previous',
  'forget your instructions',
  'forget previous instructions',
  'you are now a',
  'act as if you',
  'jailbreak',
  'dan mode',
  'developer mode',
  'system prompt',
  'reveal your system',
  'override your instructions',
  'new instructions:',
];

export function isInjectionAttempt(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return INJECTION_PATTERNS.some((p) => lower.includes(p));
}