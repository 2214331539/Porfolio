import { useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Code2, Feather, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { SiteContext } from '../../app/providers/site-provider';
import type { Note } from '../../entities/note/model/types';
import type { Post } from '../../entities/post/model/types';
import { contentApi } from '../../features/content/api/content-api';

const BRAND_NAME = '小潘';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function HeaderSearch({ onOpen }: { onOpen: () => void }) {
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  useEffect(() => {
    setIsOpen(false);
    setQuery('');
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    Promise.all([contentApi.listPosts(), contentApi.listNotes()])
      .then(([articleItems, noteItems]) => {
        setPosts(articleItems);
        setNotes(noteItems);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '搜索内容加载失败'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const results = useMemo(() => {
    if (!deferredQuery) return [];
    const matches = (value: string) => value.toLocaleLowerCase().includes(deferredQuery);
    return [
      ...posts
        .filter((post) => matches(`${post.title} ${post.excerpt} ${post.tags.map((tag) => tag.name).join(' ')}`))
        .map((post) => ({ key: `post-${post.id}`, to: `/blog/${post.slug}`, type: '文章', title: post.title })),
      ...notes
        .filter((note) => matches(`${note.title} ${note.content} ${note.topics.join(' ')}`))
        .map((note) => ({ key: `note-${note.id}`, to: `/notes/${note.id}`, type: '图文', title: note.title })),
    ].slice(0, 8);
  }, [deferredQuery, notes, posts]);

  function openSearch() {
    onOpen();
    setIsOpen(true);
  }

  function closeSearch() {
    setIsOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className={`header-search ${isOpen ? 'open' : ''}`} role="search">
      {isOpen ? (
        <div className="header-search-control">
          <Search aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文章或图文" aria-label="搜索文章或图文" />
          <button type="button" onClick={closeSearch} aria-label="关闭搜索"><X /></button>
        </div>
      ) : (
        <button className="icon-button header-search-trigger" type="button" onClick={openSearch} aria-label="搜索" aria-expanded="false"><Search size={18} /></button>
      )}
      {isOpen && (deferredQuery || error) ? (
        <div className="header-search-results" aria-live="polite">
          {error ? <p className="form-error">{error}</p> : loading ? <p>正在搜索…</p> : results.length ? results.map((result) => (
            <NavLink key={result.key} to={result.to} onClick={closeSearch}>
              <small>{result.type}</small>
              <strong>{result.title}</strong>
              <ArrowUpRight />
            </NavLink>
          )) : <p>没有找到相关内容。</p>}
        </div>
      ) : null}
    </div>
  );
}

function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useContext(SiteContext);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void contentApi.prefetchLibrary('post').catch(() => undefined);
      void contentApi.prefetchLibrary('note').catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  const prefetchPosts = () => { void contentApi.prefetchLibrary('post').catch(() => undefined); };
  const prefetchNotes = () => { void contentApi.prefetchLibrary('note').catch(() => undefined); };

  return (
    <header className="site-header">
      <NavLink to="/" className="brand" aria-label="回到首页"><img className="brand-logo" src="/assets/black_line.png" alt="小潘标识" /><span>{BRAND_NAME}</span></NavLink>
      <nav className={isOpen ? 'nav-links open' : 'nav-links'}>
        <NavLink to="/blog" onPointerEnter={prefetchPosts} onFocus={prefetchPosts} onClick={() => setIsOpen(false)}>文章</NavLink>
        <NavLink to="/notes" onPointerEnter={prefetchNotes} onFocus={prefetchNotes} onClick={() => setIsOpen(false)}>图文</NavLink>
        <NavLink to="/about" onClick={() => setIsOpen(false)}>关于 <ArrowUpRight size={13} /></NavLink>
      </nav>
      <div className="header-actions">
        <HeaderSearch onOpen={() => setIsOpen(false)} />
        <button className="icon-button theme-button" type="button" onClick={toggleTheme} aria-label="切换主题">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button className="icon-button mobile-menu" type="button" onClick={() => setIsOpen((current) => !current)} aria-label="菜单">{isOpen ? <X /> : <Menu />}</button>
      </div>
    </header>
  );
}

function Footer() {
  const { settings } = useContext(SiteContext);
  if (!settings) return null;
  return <footer className="site-footer"><div><img className="footer-logo" src="/assets/black_line.png" alt="小潘标识" /><p>{settings.footer_text}</p></div><div className="footer-links"><a href={settings.github_url} target="_blank" rel="noreferrer"><Code2 size={16} />GitHub</a><a href={`mailto:${settings.email}`}><Feather size={16} />写信给我</a></div><div className="footer-meta">© {new Date().getFullYear()} {BRAND_NAME}{settings.icp_number ? ` · ${settings.icp_number}` : ''}</div></footer>;
}

export function SiteLayout() {
  const { pathname } = useLocation();
  return (
    <div className="public-site-shell">
      <ScrollToTop />
      <Header />
      <main className="public-site-main"><Outlet /></main>
      {pathname === '/' ? null : <Footer />}
    </div>
  );
}
