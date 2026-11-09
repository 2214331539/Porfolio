import type { InfoSource, InfoSourceInput } from '../../entities/source/model/types';
import { http } from '../../shared/api/http-client';

let publicCache: InfoSource[] | undefined;

export const sourcesApi = {
  list: async () => (publicCache = await http<InfoSource[]>('/sources')),
  cached: () => publicCache,
  listAdmin: () => http<InfoSource[]>('/admin/sources'),
  async save(input: InfoSourceInput, id?: number) {
    const saved = await http<InfoSource>(id ? `/admin/sources/${id}` : '/admin/sources', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) });
    publicCache = undefined;
    return saved;
  },
  async remove(id: number) {
    await http<{ ok: boolean }>(`/admin/sources/${id}`, { method: 'DELETE' });
    publicCache = undefined;
  },
};

export const hostOf = (url: string) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; } };
