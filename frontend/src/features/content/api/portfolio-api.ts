import { apiUrl, http } from '../../../shared/api/http-client';
import type { Portfolio, Project, ProjectInput, PortfolioProfile } from '../../../entities/project/model/projects';

export function portfolioAssetUrl(value: string) {
  return value.startsWith('/uploads/') ? new URL(value, new URL(apiUrl('/'), window.location.origin)).href : value;
}

export const portfolioApi = {
  get: (admin = false) => http<Portfolio>(admin ? '/admin/portfolio' : '/portfolio', { cache: 'no-store' }),
  getProject: (id: number) => http<Project>(`/admin/projects/${id}`, { cache: 'no-store' }),
  saveProject: (input: ProjectInput, id?: number) => http<Project>(id ? `/admin/projects/${id}` : '/admin/projects', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }),
  deleteProject: (id: number) => http<{ ok: boolean }>(`/admin/projects/${id}`, { method: 'DELETE' }),
  saveProfile: (profile: PortfolioProfile) => http<PortfolioProfile>('/admin/portfolio/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  upload: (file: File) => {
    const body = new FormData(); body.append('file', file);
    return http<{ url: string }>('/admin/upload', { method: 'POST', body });
  },
};
