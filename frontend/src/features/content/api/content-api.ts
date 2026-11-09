import type { Note, NoteInput } from '../../../entities/note/model/types';
import type { Post, PostInput } from '../../../entities/post/model/types';
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
export type BulkAction = 'move' | 'publish' | 'draft' | 'delete';
const cacheTimes = new Map<string, number>();
const fresh = (key: string) => cacheTimes.has(key) && Date.now() - (cacheTimes.get(key) ?? 0) < PUBLIC_CACHE_TTL;
// Uploaded files live at the API server's origin, outside its /api prefix.
const apiOrigin = () => new URL(apiUrl('/'), window.location.origin).origin;
export const assetUrl = (value: string | null | undefined) => value && value.startsWith('/')
  ? new URL(value, apiOrigin()).href
  : value;
/** Uploaded files are stored as `/uploads/…` so content keeps working if the domain changes. */
export const storedAssetUrl = (value: string) => value.startsWith(`${apiOrigin()}/uploads/`) ? value.slice(apiOrigin().length) : value;
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

function invalidateAll(contentType: RepositoryContentType) {
  invalidatePublicContent(contentType);
}

export const contentApi = {
  listPosts: (isAdmin = false) => isAdmin ? http<Post[]>('/admin/posts').then((posts) => posts.map(normalizePost)) : listPublicPosts(),
  getAdminPost: (id: number) => http<Post>(`/admin/posts/${id}`).then(normalizePost),
  getPost: (slug: string) => http<Post>(`/posts/${encodeURIComponent(slug)}`).then(normalizePost),
  listNotes: (isAdmin = false) => isAdmin ? http<Note[]>('/admin/notes').then((notes) => notes.map(normalizeNote)) : listPublicNotes(),
  getNote: (id: number) => http<Note>(`/notes/${id}`).then(normalizeNote),
  getAdminNote: (id: number) => http<Note>(`/admin/notes/${id}`).then(normalizeNote),
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
  async savePost(post: PostInput) { const saved = await http<Post>(post.id ? `/admin/posts/${post.id}` : '/admin/posts', { method: post.id ? 'PUT' : 'POST', body: JSON.stringify(post) }); invalidatePublicContent('post'); return normalizePost(saved); },
  async deletePost(id: number) { const result = await http<{ ok: boolean }>(`/admin/posts/${id}`, { method: 'DELETE' }); invalidatePublicContent('post'); return result; },
  async saveNote(note: NoteInput) { const saved = await http<Note>(note.id ? `/admin/notes/${note.id}` : '/admin/notes', { method: note.id ? 'PUT' : 'POST', body: JSON.stringify(note) }); invalidatePublicContent('note'); return normalizeNote(saved); },
  async bulk(contentType: RepositoryContentType, ids: number[], action: BulkAction, repositoryId: number | null = null) { const result = await http<{ ok: boolean; count: number }>(`/admin/${contentType === 'post' ? 'posts' : 'notes'}/bulk`, { method: 'POST', body: JSON.stringify({ ids, action, repository_id: repositoryId }) }); invalidateAll(contentType); return result; },
  async deleteNote(id: number) { const result = await http<{ ok: boolean }>(`/admin/notes/${id}`, { method: 'DELETE' }); invalidatePublicContent('note'); return result; },
  async saveRepository(repository: RepositoryInput) { const saved = await http<ContentRepository>(repository.id ? `/admin/repositories/${repository.id}` : '/admin/repositories', { method: repository.id ? 'PUT' : 'POST', body: JSON.stringify(repository) }); invalidatePublicContent(repository.content_type); return saved; },
  async moveRepository(id: number, contentType: RepositoryContentType, parentId: number | null, position: number) { const result = await http<ContentRepository[]>(`/admin/repositories/${id}/move`, { method: 'POST', body: JSON.stringify({ parent_id: parentId, position }) }); invalidateAll(contentType); return result; },
  async deleteRepository(id: number, contentType: RepositoryContentType, liftContents = false) { const result = await http<{ ok: boolean }>(`/admin/repositories/${id}${liftContents ? '?lift_contents=true' : ''}`, { method: 'DELETE' }); invalidateAll(contentType); return result; },
  async saveResumeVersion(version: Partial<ResumeVersion>) { const saved = await http<ResumeVersion>(version.id ? `/admin/resumes/${version.id}` : '/admin/resumes', { method: version.id ? 'PUT' : 'POST', body: JSON.stringify(version) }); publicResumeCache = undefined; cacheTimes.delete('resumes'); return saved; },
  async deleteResumeVersion(id: number) { const result = await http<{ ok: boolean }>(`/admin/resumes/${id}`, { method: 'DELETE' }); publicResumeCache = undefined; cacheTimes.delete('resumes'); return result; },
  uploadImage: async (file: File) => { const body = new FormData(); body.append('file', file); const result = await http<{ url: string }>('/admin/upload', { method: 'POST', body }); return { path: result.url, url: assetUrl(result.url) ?? result.url }; },
  uploadDocument: async (file: File) => { const body = new FormData(); body.append('file', file); const result = await http<{ url: string }>('/admin/upload-document', { method: 'POST', body }); return { ...result, url: assetUrl(result.url) ?? result.url }; },
  likeNote: (id: number) => http<Note>(`/notes/${id}/like`, { method: 'POST' }),
};
