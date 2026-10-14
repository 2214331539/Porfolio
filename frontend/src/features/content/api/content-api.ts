import type { Note } from '../../../entities/note/model/types';
import type { Post } from '../../../entities/post/model/types';
import type { Dashboard, SiteSettings } from '../../../entities/site/model/types';
import type { ContentRepository, RepositoryContentType, RepositoryInput } from '../../../entities/repository/model/types';
import type { ResumeVersion } from '../../../entities/resume/model/types';
import { apiUrl, http } from '../../../shared/api/http-client';

let publicPostsCache: Post[] | undefined;
let publicNotesCache: Note[] | undefined;
const publicRepositoryCache = new Map<RepositoryContentType, ContentRepository[]>();
let publicPostsRequest: Promise<Post[]> | undefined;
let publicNotesRequest: Promise<Note[]> | undefined;
const publicRepositoryRequests = new Map<RepositoryContentType, Promise<ContentRepository[]>>();
let publicResumeCache: ResumeVersion[] | undefined;
let publicResumeRequest: Promise<ResumeVersion[]> | undefined;
const PUBLIC_CACHE_TTL = 30_000;
const cacheTimes = new Map<string, number>();
const fresh = (key: string) => cacheTimes.has(key) && Date.now() - (cacheTimes.get(key) ?? 0) < PUBLIC_CACHE_TTL;
// Uploaded files live at the API server's origin, outside its /api prefix.
const assetUrl = (value: string | null | undefined) => value && value.startsWith('/')
  ? new URL(value, new URL(apiUrl('/'), window.location.origin)).href
  : value;
const normalizePost = (post: Post) => ({ ...post, cover_url: assetUrl(post.cover_url) });
const normalizeNote = (note: Note) => ({ ...note, images: note.images.map((image) => assetUrl(image) ?? image) });
const normalizeResume = (version: ResumeVersion) => ({ ...version, image_url: assetUrl(version.image_url) ?? version.image_url, pdf_url: assetUrl(version.pdf_url) });

function listPublicPosts() {
  if (publicPostsCache && fresh('posts')) return Promise.resolve(publicPostsCache);
  if (!publicPostsRequest) {
    publicPostsRequest = http<Post[]>('/posts')
      .then((posts) => {
        publicPostsCache = posts.map(normalizePost); cacheTimes.set('posts', Date.now());
        return publicPostsCache;
      })
      .finally(() => { publicPostsRequest = undefined; });
  }
  return publicPostsRequest;
}

function listPublicNotes() {
  if (publicNotesCache && fresh('notes')) return Promise.resolve(publicNotesCache);
  if (!publicNotesRequest) {
    publicNotesRequest = http<Note[]>('/notes')
      .then((notes) => {
        publicNotesCache = notes.map(normalizeNote); cacheTimes.set('notes', Date.now());
        return publicNotesCache;
      })
      .finally(() => { publicNotesRequest = undefined; });
  }
  return publicNotesRequest;
}

function listPublicRepositories(contentType: RepositoryContentType) {
  const cached = publicRepositoryCache.get(contentType);
  if (cached && fresh(`repositories:${contentType}`)) return Promise.resolve(cached);
  const pending = publicRepositoryRequests.get(contentType);
  if (pending) return pending;
  const request = http<ContentRepository[]>(`/repositories?content_type=${contentType}`)
    .then((repositories) => {
      publicRepositoryCache.set(contentType, repositories); cacheTimes.set(`repositories:${contentType}`, Date.now());
      return repositories;
    })
    .finally(() => { publicRepositoryRequests.delete(contentType); });
  publicRepositoryRequests.set(contentType, request);
  return request;
}

function invalidatePublicContent(contentType: RepositoryContentType) {
  if (contentType === 'post') { publicPostsCache = undefined; cacheTimes.delete('posts'); }
  else { publicNotesCache = undefined; cacheTimes.delete('notes'); }
  publicRepositoryCache.delete(contentType);
  cacheTimes.delete(`repositories:${contentType}`);
}

function listPublicResumeVersions() {
  if (publicResumeCache && fresh('resumes')) return Promise.resolve(publicResumeCache);
  if (!publicResumeRequest) {
    publicResumeRequest = http<ResumeVersion[]>('/resumes')
      .then((versions) => {
        publicResumeCache = versions.map(normalizeResume); cacheTimes.set('resumes', Date.now());
        return publicResumeCache;
      })
      .finally(() => { publicResumeRequest = undefined; });
  }
  return publicResumeRequest;
}

export const contentApi = {
  listPosts: (isAdmin = false) => isAdmin ? http<Post[]>('/admin/posts') : listPublicPosts(),
  getAdminPost: (id: number) => http<Post>(`/admin/posts/${id}`),
  getPost: (slug: string) => http<Post>(`/posts/${slug}`),
  listNotes: (isAdmin = false) => isAdmin ? http<Note[]>('/admin/notes') : listPublicNotes(),
  getNote: (id: number) => http<Note>(`/notes/${id}`),
  listRepositories: (contentType: RepositoryContentType, isAdmin = false) => isAdmin ? http<ContentRepository[]>(`/admin/repositories?content_type=${contentType}`) : listPublicRepositories(contentType),
  getCachedPosts: () => publicPostsCache,
  getCachedNotes: () => publicNotesCache,
  getCachedRepositories: (contentType: RepositoryContentType) => publicRepositoryCache.get(contentType),
  prefetchLibrary: (contentType: RepositoryContentType) => contentType === 'post'
    ? Promise.all([listPublicPosts(), listPublicRepositories('post')])
    : Promise.all([listPublicNotes(), listPublicRepositories('note')]),
  listResumeVersions: (isAdmin = false) => isAdmin ? http<ResumeVersion[]>('/admin/resumes') : listPublicResumeVersions(),
  getCachedResumeVersions: () => publicResumeCache,
  resumeDownloadUrl: (id: number) => apiUrl(`/resumes/${id}/download`),
  getSettings: () => http<SiteSettings>('/settings'),
  getDashboard: () => http<Dashboard>('/admin/dashboard'),
  saveSettings: (settings: SiteSettings) => http<SiteSettings>('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  async savePost(post: Partial<Post>) { const saved = await http<Post>(post.id ? `/admin/posts/${post.id}` : '/admin/posts', { method: post.id ? 'PUT' : 'POST', body: JSON.stringify(post) }); invalidatePublicContent('post'); return saved; },
  async deletePost(id: number) { const result = await http<{ ok: boolean }>(`/admin/posts/${id}`, { method: 'DELETE' }); invalidatePublicContent('post'); return result; },
  async saveNote(note: Partial<Note>) { const saved = await http<Note>(note.id ? `/admin/notes/${note.id}` : '/admin/notes', { method: note.id ? 'PUT' : 'POST', body: JSON.stringify(note) }); invalidatePublicContent('note'); return saved; },
  async deleteNote(id: number) { const result = await http<{ ok: boolean }>(`/admin/notes/${id}`, { method: 'DELETE' }); invalidatePublicContent('note'); return result; },
  async saveRepository(repository: RepositoryInput) { const saved = await http<ContentRepository>(repository.id ? `/admin/repositories/${repository.id}` : '/admin/repositories', { method: repository.id ? 'PUT' : 'POST', body: JSON.stringify(repository) }); invalidatePublicContent(repository.content_type); return saved; },
  async deleteRepository(id: number, contentType?: RepositoryContentType) { const result = await http<{ ok: boolean }>(`/admin/repositories/${id}`, { method: 'DELETE' }); if (contentType) invalidatePublicContent(contentType); else publicRepositoryCache.clear(); return result; },
  async saveResumeVersion(version: Partial<ResumeVersion>) { const saved = await http<ResumeVersion>(version.id ? `/admin/resumes/${version.id}` : '/admin/resumes', { method: version.id ? 'PUT' : 'POST', body: JSON.stringify(version) }); publicResumeCache = undefined; cacheTimes.delete('resumes'); return saved; },
  async deleteResumeVersion(id: number) { const result = await http<{ ok: boolean }>(`/admin/resumes/${id}`, { method: 'DELETE' }); publicResumeCache = undefined; cacheTimes.delete('resumes'); return result; },
  uploadImage: async (file: File) => { const body = new FormData(); body.append('file', file); const result = await http<{ url: string }>('/admin/upload', { method: 'POST', body }); return { ...result, url: assetUrl(result.url) ?? result.url }; },
  uploadDocument: async (file: File) => { const body = new FormData(); body.append('file', file); const result = await http<{ url: string }>('/admin/upload-document', { method: 'POST', body }); return { ...result, url: assetUrl(result.url) ?? result.url }; },
  likeNote: (id: number) => http<Note>(`/notes/${id}/like`, { method: 'POST' }),
};
