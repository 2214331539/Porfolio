import { useEffect, useMemo, useState } from 'react';
import { Images } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Note } from '../../entities/note/model/types';
import type { ContentRepository } from '../../entities/repository/model/types';
import { descendantIds, flattenRepositories, totalCounts } from '../../entities/repository/model/tree';
import { contentApi } from '../../features/content/api/content-api';
import { EmptyState, NoteCard, PageState } from '../../shared/ui';

const repositoryOf = (note: Note) => note.repository?.id ?? note.repository_id ?? null;

export default function NotesPage() {
  const cachedNotes = contentApi.getCachedNotes();
  const cachedRepositories = contentApi.getCachedRepositories('note');
  const [notes, setNotes] = useState<Note[]>(cachedNotes ?? []);
  const [repositories, setRepositories] = useState<ContentRepository[]>(cachedRepositories ?? []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(!cachedNotes || !cachedRepositories);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([contentApi.listNotes(), contentApi.listRepositories('note')])
      .then(([noteItems, repositoryItems]) => { setNotes(noteItems); setRepositories(repositoryItems); })
      .catch((err) => setError(err instanceof Error ? err.message : '图文加载失败'))
      .finally(() => setLoading(false));
    document.title = '图文 · 小潘同学';
    return () => { document.title = '小潘同学'; };
  }, []);

  const requestedId = Number(searchParams.get('repository')) || null;
  const currentId = repositories.some((repository) => repository.id === requestedId) ? requestedId : null;
  const totals = useMemo(() => totalCounts(repositories, notes.map(repositoryOf)), [notes, repositories]);
  const shown = useMemo(() => {
    const scope = currentId ? descendantIds(repositories, currentId) : null;
    return notes.filter((note) => !scope || scope.has(repositoryOf(note) ?? -1));
  }, [currentId, notes, repositories]);

  if (loading) return <PageState>正在整理图文…</PageState>;
  if (error) return <PageState tone="error">{error}</PageState>;

  return (
    <div className="notes-page container">
      <header className="page-head">
        <h1>图文<small>{notes.length}</small></h1>
        {repositories.length ? (
          <div className="chip-row" role="tablist" aria-label="图文分类">
            <button type="button" role="tab" aria-selected={currentId === null} className={`chip ${currentId === null ? 'active' : ''}`} onClick={() => setSearchParams({})}>全部<small>{notes.length}</small></button>
            {flattenRepositories(repositories).map((repository) => (
              <button type="button" role="tab" key={repository.id} aria-selected={currentId === repository.id} className={`chip ${currentId === repository.id ? 'active' : ''}`} onClick={() => setSearchParams({ repository: String(repository.id) })}>
                {repository.depth ? '· ' : ''}{repository.name}<small>{totals.get(repository.id) ?? 0}</small>
              </button>
            ))}
          </div>
        ) : null}
      </header>
      {shown.length ? (
        <div className="card-grid photos">{shown.map((note) => <NoteCard key={note.id} note={note} tall />)}</div>
      ) : (
        <EmptyState icon={<Images aria-hidden="true" />} title="这里还没有图文" />
      )}
    </div>
  );
}
