import { useEffect, useMemo, useState } from 'react';
import type { Doing } from '../../entities/doing/model/types';
import { Clothesline } from '../../features/doing/Clothesline';
import { doingApi } from '../../features/doing/doing-api';
import { DoingSheet } from '../../features/doing/DoingSheet';
import { PageState } from '../../shared/ui';

export default function DoingPage() {
  const [items, setItems] = useState<Doing[]>(doingApi.cached() ?? []);
  const [loading, setLoading] = useState(!doingApi.cached());
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Doing | null>(null);

  useEffect(() => {
    doingApi.list().then(setItems).catch((err) => setError(err instanceof Error ? err.message : '加载失败')).finally(() => setLoading(false));
    document.title = 'Doing · 小潘同学';
    return () => { document.title = '小潘同学'; };
  }, []);

  const main = useMemo(() => items.filter((item) => item.kind === 'main'), [items]);
  const side = useMemo(() => items.filter((item) => item.kind === 'side'), [items]);

  if (loading) return <PageState>正在挂纸条…</PageState>;
  if (error) return <PageState tone="error">{error}</PageState>;

  return (
    <div className="doing-page container">
      <h1 className="page-title">Doing<small>{items.length}</small></h1>
      {items.length === 0 ? <p className="doing-empty">绳子上还空着</p> : null}
      <Clothesline kind="main" label="主线" items={main} onOpen={setOpen} />
      <Clothesline kind="side" label="临时线" items={side} onOpen={setOpen} />
      {open ? <DoingSheet item={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
