import { lazy, Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from '../../widgets/site-layout/SiteLayout';
import BlogPage from '../../pages/blog/BlogPage';
import NotesPage from '../../pages/notes/NotesPage';

const HomePage = lazy(() => import('../../pages/home/HomePage'));
const PostPage = lazy(() => import('../../pages/blog/PostPage'));
const NotePage = lazy(() => import('../../pages/notes/NotePage'));
const AboutPage = lazy(() => import('../../pages/about/AboutPage'));
const AdminPage = lazy(() => import('../../pages/admin/AdminPage'));

function PageLoading() { return <div className="page-loading"><img src="/assets/black_medium.png" alt=""/><span>正在翻页…</span></div>; }
function NotFound() { return <div className="not-found"><img src="/assets/black_line.png" alt=""/><p className="eyebrow">404 / LOST PAGE</p><h1>这一页还没写。</h1><Link className="text-link" to="/">回到首页 <ArrowUpRight/></Link></div>; }
function DeferredPage({ children }: { children: React.ReactNode }) { return <Suspense fallback={<PageLoading/>}>{children}</Suspense>; }

export function AppRouter() { return <Routes><Route element={<SiteLayout/>}><Route path="/" element={<DeferredPage><HomePage/></DeferredPage>}/><Route path="/blog" element={<BlogPage/>}/><Route path="/blog/:slug" element={<DeferredPage><PostPage/></DeferredPage>}/><Route path="/notes" element={<NotesPage/>}/><Route path="/notes/:id" element={<DeferredPage><NotePage/></DeferredPage>}/><Route path="/about" element={<DeferredPage><AboutPage/></DeferredPage>}/><Route path="/404" element={<NotFound/>}/><Route path="*" element={<Navigate to="/404" replace/>}/></Route><Route path="/admin/*" element={<DeferredPage><AdminPage/></DeferredPage>}/></Routes>; }
