import { ScoreBand } from '../stores/useAppStore';

export const SCORE_BAND_META: Record<ScoreBand, { label: string; desc: string }> = {
  '70s': { label: 'Basic Track', desc: '기초와 해석부터 차근차근' },
  '80s': { label: 'Pro Track', desc: '정확도와 실전 감각 강화' },
  '90plus': { label: 'Master Track', desc: '변별력과 완성도 집중' },
};

export function getRecommendedScoreBand(score?: number | null): ScoreBand | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  if (score >= 90) return '90plus';
  if (score >= 80) return '80s';
  return '70s';
}
