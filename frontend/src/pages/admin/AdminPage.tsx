import { useContext, useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { ArrowUpRight, BookOpen, FileText, Files, Image, LayoutDashboard, LogOut, Menu, Moon, Orbit, Server, Settings, Sun, X } from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SiteContext } from '../../app/providers/site-provider';
import { authApi } from '../../features/auth/api/auth-api';
import { AUTH_EXPIRED_EVENT } from '../../shared/api/http-client';
import { errorMessage } from '../../shared/format';
import '../../app/styles/admin.css';
import { AdminUiProvider, useAdminUi } from './AdminUi';
import { Dashboard } from './Dashboard';
import { NoteEditor } from './editor/NoteEditor';
import { PostEditor } from './editor/PostEditor';
import { LibraryPage } from './library/LibraryPage';
import { PortfolioAdmin, PortfolioProfileEditor, PortfolioProjectEditor } from './PortfolioAdmin';
import { ResumeVersionsAdmin } from './ResumeVersionsAdmin';
import { ServerDeckAdmin } from './ServerDeckAdmin';
import { SettingsPage } from './SettingsPage';
import { SourcesAdmin } from './SourcesAdmin';

type NavItem = { to: string; label: string; icon: typeof FileText; end?: boolean };
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: '', items: [{ to: '/admin', label: '总览', icon: LayoutDashboard, end: true }] },
  { label: '内容', items: [{ to: '/admin/posts', label: '文章', icon: FileText }, { to: '/admin/notes', label: '图文', icon: Image }] },
  { label: '展示', items: [{ to: '/admin/portfolio', label: '作品集', icon: BookOpen }, { to: '/admin/sources', label: '信息源泉', icon: Orbit }, { to: '/admin/resumes', label: '简历', icon: Files }] },
  { label: '系统', items: [{ to: '/admin/settings', label: '站点设置', icon: Settings }, { to: '/admin/server-deck', label: '服务器', icon: Server }] },
];

function Login({ onDone, expired }: { onDone: () => void; expired: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(expired ? '登录已过期，请重新登录。' : '');
  const [loading, setLoading] = useState(false);
  const { settings } = useContext(SiteContext);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try { await authApi.login(username, password); onDone(); } catch (err) { setError(errorMessage(err, '登录失败，请确认后端已启动')); } finally { setLoading(false); }
  }
  return (
    <div className="admin-login">
      <form className="login-card" onSubmit={submit}>
        <img src="/assets/avatar.png" alt="" />
        <h1>{settings?.site_title || '小潘同学'} · 后台</h1>
        <p>登录后管理文章、图文与作品。</p>
        <label className="field"><span>账号</span><input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus spellCheck={false} /></label>
        <label className="field"><span>密码</span><input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error ? <div className="notice error" role="alert">{error}</div> : null}
        <button className="button primary block" disabled={loading || !username || !password}>{loading ? '正在验证…' : '登录'}</button>
        <Link className="login-back" to="/">← 返回网站</Link>
      </form>
    </div>
  );
}

function Sidebar({ onLogout, onNavigate }: { onLogout: () => void; onNavigate: () => void }) {
  const navigate = useNavigate();
  const { runAfterDiscardCheck, hasUnsavedChanges } = useAdminUi();
  const { settings, theme, toggleTheme } = useContext(SiteContext);
  function guard(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!hasUnsavedChanges) { onNavigate(); return; }
    event.preventDefault();
    runAfterDiscardCheck(() => { navigate(to); onNavigate(); });
  }
  return (
    <aside className="admin-sidebar">
      <Link to="/admin" className="admin-brand" onClick={(event) => guard(event, '/admin')}>
        <img src="/assets/avatar.png" alt="" />
        <span>{settings?.site_title || '小潘同学'}</span>
      </Link>
      <nav aria-label="后台导航">
        {NAV_GROUPS.map((group) => (
          <div className="admin-nav-group" key={group.label || 'home'}>
            {group.label ? <small>{group.label}</small> : null}
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} title={label} onClick={(event) => guard(event, to)}><Icon aria-hidden="true" />{label}</NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="admin-sidebar-foot">
        <a href="/" target="_blank" rel="noreferrer"><ArrowUpRight aria-hidden="true" />查看网站</a>
        <button type="button" onClick={toggleTheme}>{theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}{theme === 'light' ? '深色模式' : '浅色模式'}</button>
        <button type="button" onClick={() => runAfterDiscardCheck(onLogout)}><LogOut aria-hidden="true" />退出登录</button>
      </div>
    </aside>
  );
}

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [mobileNav, setMobileNav] = useState(false);
  const { pathname } = useLocation();
  const editing = /^\/admin\/(posts|notes)\/[^/]+$/.test(pathname);
  useEffect(() => { setMobileNav(false); }, [pathname]);
  return (
    <div className={`admin ${editing ? 'is-editing' : ''}`}>
      <a className="skip-link" href="#admin-main">跳到主要内容</a>
      <div className={`admin-sidebar-wrap ${mobileNav ? 'open' : ''}`}>
        <Sidebar onLogout={onLogout} onNavigate={() => setMobileNav(false)} />
        {mobileNav ? <button type="button" className="admin-scrim" onClick={() => setMobileNav(false)} aria-label="关闭导航" /> : null}
      </div>
      <header className="admin-mobile-bar">
        <button type="button" className="icon-button" onClick={() => setMobileNav((value) => !value)} aria-label="导航" aria-expanded={mobileNav}>{mobileNav ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        <strong>后台</strong>
      </header>
      <main className="admin-main" id="admin-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="posts" element={<LibraryPage key="post" type="post" />} />
          <Route path="posts/:id" element={<PostEditor />} />
          <Route path="notes" element={<LibraryPage key="note" type="note" />} />
          <Route path="notes/:id" element={<NoteEditor />} />
          <Route path="repositories" element={<Navigate to="/admin/posts" replace />} />
          <Route path="portfolio" element={<PortfolioAdmin />} />
          <Route path="portfolio/profile" element={<PortfolioProfileEditor />} />
          <Route path="portfolio/new" element={<PortfolioProjectEditor />} />
          <Route path="portfolio/:id" element={<PortfolioProjectEditor />} />
          <Route path="sources" element={<SourcesAdmin />} />
          <Route path="resumes" element={<ResumeVersionsAdmin />} />
          <Route path="server-deck" element={<ServerDeckAdmin />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(authApi.isAuthenticated());
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const onExpired = () => { setExpired(true); setAuthed(false); };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);
  useEffect(() => {
    document.title = '后台 · 小潘同学';
    return () => { document.title = '小潘同学'; };
  }, []);
  if (!authed) return <Login expired={expired} onDone={() => { setExpired(false); setAuthed(true); }} />;
  return (
    <AdminUiProvider>
      <AdminShell onLogout={() => { authApi.logout(); setAuthed(false); }} />
    </AdminUiProvider>
  );
}
