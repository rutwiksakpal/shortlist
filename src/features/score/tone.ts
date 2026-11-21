export function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 85) return { ring: '#059669', text: 'text-emerald-600 dark:text-emerald-400', label: 'Strong' };
  if (score >= 70) return { ring: '#4F46E5', text: 'text-indigo-600 dark:text-indigo-400', label: 'Good' };
  if (score >= 50) return { ring: '#D97706', text: 'text-amber-600 dark:text-amber-400', label: 'Needs work' };
  return { ring: '#DC2626', text: 'text-red-600 dark:text-red-400', label: 'Weak' };
}
