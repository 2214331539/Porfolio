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

function listPublicPosts() {
  if (publicPostsCache) return Promise.resolve(publicPostsCache);
  if (!publicPostsRequest) {
    publicPostsRequest = http<Post[]>('/posts')
      .then((posts) => {
        publicPostsCache = posts;
        return posts;
      })
      .finally(() => { publicPostsRequest = undefined; });
  }
  return publicPostsRequest;
}

function listPublicNotes() {
  if (publicNotesCache) return Promise.resolve(publicNotesCache);
  if (!publicNotesRequest) {
    publicNotesRequest = http<Note[]>('/notes')
      .then((notes) => {
        publicNotesCache = notes;
        return notes;
      })
      .finally(() => { publicNotesRequest = undefined; });
  }
  return publicNotesRequest;
}

function listPublicRepositories(contentType: RepositoryContentType) {
  const cached = publicRepositoryCache.get(contentType);
  if (cached) return Promise.resolve(cached);
  const pending = publicRepositoryRequests.get(contentType);
  if (pending) return pending;
  const request = http<ContentRepository[]>(`/repositories?content_type=${contentType}`)
    .then((repositories) => {
      publicRepositoryCache.set(contentType, repositories);
      return repositories;
    })
    .finally(() => { publicRepositoryRequests.delete(contentType); });
  publicRepositoryRequests.set(contentType, request);
  return request;
}

function invalidatePublicContent(contentType: RepositoryContentType) {
  if (contentType === 'post') publicPostsCache = undefined;
  else publicNotesCache = undefined;
  publicRepositoryCache.delete(contentType);
}

function listPublicResumeVersions() {
  if (publicResumeCache) return Promise.resolve(publicResumeCache);
  if (!publicResumeRequest) {
    publicResumeRequest = http<ResumeVersion[]>('/resumes')
      .then((versions) => {
        publicResumeCache = versions;
        return versions;
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
  async saveResumeVersion(version: Partial<ResumeVersion>) { const saved = await http<ResumeVersion>(version.id ? `/admin/resumes/${version.id}` : '/admin/resumes', { method: version.id ? 'PUT' : 'POST', body: JSON.stringify(version) }); publicResumeCache = undefined; return saved; },
  async deleteResumeVersion(id: number) { const result = await http<{ ok: boolean }>(`/admin/resumes/${id}`, { method: 'DELETE' }); publicResumeCache = undefined; return result; },
  uploadImage: (file: File) => { const body = new FormData(); body.append('file', file); return http<{ url: string }>('/admin/upload', { method: 'POST', body }); },
  uploadDocument: (file: File) => { const body = new FormData(); body.append('file', file); return http<{ url: string }>('/admin/upload-document', { method: 'POST', body }); },
  likeNote: (id: number) => http<Note>(`/notes/${id}/like`, { method: 'POST' }),
};
