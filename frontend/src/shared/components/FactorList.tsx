import type { Factor } from '../../demo/gateway';

export function FactorList({ factors, audience }: { factors: Factor[]; audience: 'client' | 'bank' }) {
  // Public projection contains no score, source, raw value or rule trace.
  return factors.length ? <ul className="factor-list" aria-label={audience === 'client' ? 'Объяснение решения' : 'Факторы решения'}>{factors.map((f, i) => <li key={`${f.code}-${i}`}><span className={`factor-dot factor-dot--${f.impact.toLowerCase()}`} aria-hidden="true" /><div><p>{f.text}</p>{f.hint && <p className="form-hint">{f.hint}</p>}</div></li>)}</ul> : <p>Подробные причины ещё не получены.</p>;
}
