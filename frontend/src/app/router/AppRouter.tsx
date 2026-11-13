import { lazy, Suspense, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from '../../widgets/site-layout/SiteLayout';
import BlogPage from '../../pages/blog/BlogPage';
import NotesPage from '../../pages/notes/NotesPage';

const HomePage = lazy(() => import('../../pages/home/HomePage'));
const PostPage = lazy(() => import('../../pages/blog/PostPage'));
const NotePage = lazy(() => import('../../pages/notes/NotePage'));
const AboutPage = lazy(() => import('../../pages/about/AboutPage'));
const PortfolioPage = lazy(() => import('../../pages/portfolio/PortfolioPage'));
const AdminPage = lazy(() => import('../../pages/admin/AdminPage'));
const SourcesPage = lazy(() => import('../../pages/sources/SourcesPage'));
const DoingPage = lazy(() => import('../../pages/doing/DoingPage'));

function PageLoading() {
  return <div className="page-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />加载中…</div>;
}

function NotFound() {
  return (
    <div className="not-found container">
      <p className="eyebrow">404</p>
      <h1>这一页还没写。</h1>
      <Link className="button" to="/">回到首页<ArrowRight aria-hidden="true" /></Link>
    </div>
  );
}

const deferred = (page: ReactNode) => <Suspense fallback={<PageLoading />}>{page}</Suspense>;

export function AppRouter() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={deferred(<HomePage />)} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={deferred(<PostPage />)} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/notes/:id" element={deferred(<NotePage />)} />
        <Route path="/portfolio" element={deferred(<PortfolioPage />)} />
        <Route path="/doing" element={deferred(<DoingPage />)} />
        <Route path="/sources" element={deferred(<SourcesPage />)} />
        <Route path="/about" element={deferred(<AboutPage />)} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
      <Route path="/admin/*" element={deferred(<AdminPage />)} />
    </Routes>
  );
}
