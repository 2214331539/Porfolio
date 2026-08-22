import { useEffect, useMemo, useState } from 'react';
import { Images } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Note } from '../../entities/note/model/types';
import type { ContentRepository } from '../../entities/repository/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { RepositoryBrowser } from '../../features/content/ui/RepositoryBrowser';
import { NoteCard } from '../../shared/ui';

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
      .then(([noteItems, repositoryItems]) => {
        setNotes(noteItems);
        setRepositories(repositoryItems);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '图文加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const requestedId = Number(searchParams.get('repository')) || null;
  const currentId = requestedId && repositories.some((repository) => repository.id === requestedId) ? requestedId : null;
  const shown = useMemo(
    () => notes.filter((note) => (note.repository?.id ?? note.repository_id ?? null) === currentId),
    [currentId, notes],
  );
  const hasChildren = repositories.some((repository) => repository.parent_id === currentId);
  function selectRepository(id: number | null) {
    setSearchParams(id ? { repository: String(id) } : {}, { replace: true });
  }

  if (loading) return <div className="page-loading">正在整理图文仓库…</div>;
  if (error) return <div className="page-loading"><div className="form-error">{error}</div></div>;
  return (
    <main className="content-library notes-library">
      <RepositoryBrowser repositories={repositories} currentId={currentId} contentLabel="图文" onSelect={selectRepository} />
      {shown.length ? (
        <div className="repository-content-grid note-repository-grid">
          {shown.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      ) : hasChildren ? null : (
        <div className="repository-empty"><Images /><strong>这里还没有图文</strong><span>可以返回上一级仓库继续浏览。</span></div>
      )}
    </main>
  );
}
