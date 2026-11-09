import { useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CornerDownLeft, FileText, Image, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SiteContext } from '../../app/providers/site-provider';
import type { Note } from '../../entities/note/model/types';
import type { Post } from '../../entities/post/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { excerptOf, plainText } from '../../shared/format';

const NAV = [
  { to: '/', label: '首页' },
  { to: '/blog', label: '文章', prefetch: 'post' as const },
  { to: '/notes', label: '图文', prefetch: 'note' as const },
  { to: '/portfolio', label: '作品' },
  { to: '/sources', label: '信息源泉' },
  { to: '/about', label: '关于' },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

type SearchResult = { key: string; to: string; kind: 'post' | 'note'; title: string; detail: string };

/** ⌘K / Ctrl+K palette searching titles, excerpts, tags and body text of published content. */
function SearchPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [posts, setPosts] = useState<Post[]>(contentApi.getCachedPosts() ?? []);
  const [notes, setNotes] = useState<Note[]>(contentApi.getCachedNotes() ?? []);
  const [error, setError] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  useEffect(() => {
    inputRef.current?.focus();
    Promise.all([contentApi.listPosts(), contentApi.listNotes()])
      .then(([postItems, noteItems]) => { setPosts(postItems); setNotes(noteItems); })
      .catch((err) => setError(err instanceof Error ? err.message : '搜索内容加载失败'));
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const index = useMemo(() => [
    ...posts.map((post) => ({ key: `post-${post.id}`, to: `/blog/${post.slug}`, kind: 'post' as const, title: post.title, detail: excerptOf(post, 60), haystack: `${post.title} ${post.excerpt} ${post.tags.map((tag) => tag.name).join(' ')} ${post.repository?.name ?? ''} ${plainText(post.content)}`.toLocaleLowerCase() })),
    ...notes.map((note) => ({ key: `note-${note.id}`, to: `/notes/${note.id}`, kind: 'note' as const, title: note.title, detail: note.topics.map((topic) => `#${topic}`).join(' ') || note.content.slice(0, 60), haystack: `${note.title} ${note.content} ${note.topics.join(' ')}`.toLocaleLowerCase() })),
  ], [notes, posts]);

  const results: SearchResult[] = useMemo(() => {
    if (!deferredQuery) return index.filter((item) => item.kind === 'post').slice(0, 5);
    const titleHits = index.filter((item) => item.title.toLocaleLowerCase().includes(deferredQuery));
    const bodyHits = index.filter((item) => !titleHits.includes(item) && item.haystack.includes(deferredQuery));
    return [...titleHits, ...bodyHits].slice(0, 10);
  }, [deferredQuery, index]);

  useEffect(() => { setActive(0); }, [deferredQuery]);

  function open(result: SearchResult | undefined) {
    if (!result) return;
    onClose();
    navigate(result.to);
  }

  return (
    <div className="search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="search-palette" role="dialog" aria-modal="true" aria-label="搜索">
        <label className="search-input">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文章、图文…"
            aria-label="搜索文章、图文"
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
              else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
              else if (event.key === 'Enter') open(results[active]);
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <div className="search-results" aria-live="polite">
          {error ? <p className="search-hint">{error}</p> : null}
          {!error && !deferredQuery ? <p className="search-label">最近文章</p> : null}
          {!error && deferredQuery && !results.length ? <p className="search-hint">没有找到“{query.trim()}”相关的内容。</p> : null}
          {results.map((result, position) => (
            <button
              type="button"
              key={result.key}
              className={position === active ? 'active' : ''}
              onMouseEnter={() => setActive(position)}
              onClick={() => open(result)}
            >
              {result.kind === 'post' ? <FileText aria-hidden="true" /> : <Image aria-hidden="true" />}
              <span><strong>{result.title}</strong><small>{result.detail}</small></span>
              {position === active ? <CornerDownLeft className="search-enter" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ onSearch }: { onSearch: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { settings, theme, toggleTheme } = useContext(SiteContext);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void contentApi.prefetchLibrary('post').catch(() => undefined);
      void contentApi.prefetchLibrary('note').catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="回到首页">
          <img src="/assets/avatar.png" alt="" />
          <span>{settings?.site_title || '小潘同学'}</span>
        </Link>
        <nav className={menuOpen ? 'site-nav open' : 'site-nav'} aria-label="主导航">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onPointerEnter={item.prefetch ? () => { void contentApi.prefetchLibrary(item.prefetch).catch(() => undefined); } : undefined}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-actions">
          <button className="search-trigger" type="button" onClick={onSearch} aria-label="搜索">
            <Search aria-hidden="true" /><span>搜索</span>
          </button>
          <button className="icon-button" type="button" onClick={toggleTheme} aria-label={theme === 'light' ? '切换到深色' : '切换到浅色'}>
            {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          <button className="icon-button menu-toggle" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="菜单" aria-expanded={menuOpen}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { settings } = useContext(SiteContext);
  const title = settings?.site_title || '小潘同学';
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <span>© {new Date().getFullYear()} {title}{settings?.icp_number ? <> · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{settings.icp_number}</a></> : null}</span>
        <nav aria-label="页脚链接">
          {settings?.email ? <a href={`mailto:${settings.email}`}>邮件</a> : null}
          {settings?.github_url ? <a href={settings.github_url} target="_blank" rel="noreferrer">GitHub</a> : null}
          {settings?.wechat_url ? <a href={settings.wechat_url} target="_blank" rel="noreferrer">公众号</a> : null}
          <Link to="/about">关于</Link>
          <button type="button" className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部"><ArrowUp aria-hidden="true" /></button>
        </nav>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="site">
      <ScrollToTop />
      <a className="skip-link" href="#main">跳到正文</a>
      <Header onSearch={() => setSearchOpen(true)} />
      <main id="main" className="site-main"><Outlet /></main>
      <Footer />
      {searchOpen ? <SearchPalette onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}
