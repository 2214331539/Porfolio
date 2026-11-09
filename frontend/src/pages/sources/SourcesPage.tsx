import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Circle, List, Shuffle } from 'lucide-react';
import type { InfoSource } from '../../entities/source/model/types';
import { BubbleField, bubbleTone, type BubbleFieldHandle } from '../../features/sources/BubbleField';
import { hostOf, sourcesApi } from '../../features/sources/sources-api';
import { PageState } from '../../shared/ui';

const stageHeight = () => Math.round(Math.min(680, Math.max(420, window.innerHeight * 0.64)));

export default function SourcesPage() {
  const [sources, setSources] = useState<InfoSource[]>(sourcesApi.cached() ?? []);
  const [loading, setLoading] = useState(!sourcesApi.cached());
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [view, setView] = useState<'bubbles' | 'list'>('bubbles');
  const [height, setHeight] = useState(stageHeight);
  const field = useRef<BubbleFieldHandle>(null);

  useEffect(() => {
    sourcesApi.list().then(setSources).catch((err) => setError(err instanceof Error ? err.message : '加载失败')).finally(() => setLoading(false));
    document.title = '信息源泉 · 小潘同学';
    const onResize = () => setHeight(stageHeight());
    window.addEventListener('resize', onResize);
    return () => { document.title = '小潘同学'; window.removeEventListener('resize', onResize); };
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    sources.forEach((source) => { if (source.category) counts.set(source.category, (counts.get(source.category) ?? 0) + 1); });
    return [...counts.entries()];
  }, [sources]);
  const groups = useMemo(() => {
    const shown = category ? sources.filter((source) => source.category === category) : sources;
    const byCategory = new Map<string, InfoSource[]>();
    shown.forEach((source) => byCategory.set(source.category || '其他', [...(byCategory.get(source.category || '其他') ?? []), source]));
    return [...byCategory.entries()];
  }, [category, sources]);

  if (loading) return <PageState>正在打开信息源泉…</PageState>;
  if (error) return <PageState tone="error">{error}</PageState>;

  return (
    <div className="sources-page">
      <header className="container sources-head">
        <div>
          <h1 className="page-title">信息源泉<small>{sources.length}</small></h1>
        </div>
        <div className="sources-tools">
          {view === 'bubbles' ? <button type="button" className="button small" onClick={() => field.current?.shake()}><Shuffle aria-hidden="true" />摇一摇</button> : null}
          <div className="segmented" role="tablist" aria-label="展示方式">
            <button type="button" role="tab" aria-selected={view === 'bubbles'} className={view === 'bubbles' ? 'active' : ''} onClick={() => setView('bubbles')}><Circle aria-hidden="true" />圆球</button>
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List aria-hidden="true" />列表</button>
          </div>
        </div>
      </header>
      {categories.length > 1 ? (
        <div className="container chip-row sources-filter" role="tablist" aria-label="分类">
          <button type="button" role="tab" aria-selected={!category} className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory(null)}>全部<small>{sources.length}</small></button>
          {categories.map(([name, count]) => (
            <button type="button" role="tab" key={name} aria-selected={category === name} className={`chip ${category === name ? 'active' : ''}`} onClick={() => setCategory(category === name ? null : name)}>{name}<small>{count}</small></button>
          ))}
        </div>
      ) : null}
      <div className="container">
        {view === 'bubbles' ? (
          <BubbleField ref={field} sources={sources} height={height} highlight={category} />
        ) : (
          <div className="source-groups">
            {groups.map(([name, items]) => (
              <section key={name} className="source-group">
                <h2>{name}</h2>
                <div className="source-grid">
                  {items.map((source) => (
                    <a key={source.id} className="source-card" href={source.url} target="_blank" rel="noopener noreferrer">
                      <span className="source-dot" style={{ background: bubbleTone(source).base }} aria-hidden="true" />
                      <span className="source-copy"><strong>{source.name}</strong><small>{hostOf(source.url)}</small>{source.description ? <p>{source.description}</p> : null}</span>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
