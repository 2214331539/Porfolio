import type { CSSProperties } from 'react';
import type { Doing, DoingInput } from '../../entities/doing/model/types';
import { http } from '../../shared/api/http-client';

let publicCache: Doing[] | undefined;

export const doingApi = {
  list: async () => (publicCache = await http<Doing[]>('/doing')),
  cached: () => publicCache,
  listAdmin: () => http<Doing[]>('/admin/doing'),
  async save(input: DoingInput, id?: number) {
    const saved = await http<Doing>(id ? `/admin/doing/${id}` : '/admin/doing', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) });
    publicCache = undefined;
    return saved;
  },
  async remove(id: number) {
    await http<{ ok: boolean }>(`/admin/doing/${id}`, { method: 'DELETE' });
    publicCache = undefined;
  },
  /** Saves the whole arrangement: ids of both lines, left to right. */
  async arrange(main: number[], side: number[]) {
    const items = await http<Doing[]>('/admin/doing/order', { method: 'PUT', body: JSON.stringify({ main, side }) });
    publicCache = undefined;
    return items;
  },
};

const parseDay = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Day number of the thing, counting the day it started as day 1. */
export function dayNumber(startedOn: string, today = new Date()) {
  const from = parseDay(startedOn);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
}

export const todayIso = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** 11.5 style label for a day. */
export const shortDay = (iso: string) => { const [, month, day] = iso.split('-').map(Number); return `${month}.${day}`; };

/** Muted paper colours, light and night versions: cream, rose, sage, mist, oat, lilac, apricot, celadon. */
const PAPERS: Array<[string, string]> = [
  ['#f1e8cd', '#4b4636'], ['#efd9d3', '#4e3d3b'], ['#dbe3d0', '#3d4839'], ['#d8e1e9', '#39454f'],
  ['#e9e1d3', '#484338'], ['#e2dae9', '#443f4f'], ['#f0dec8', '#4f4435'], ['#d4e2df', '#364848'],
];
/** A stable paper per note; stepping by 3 keeps neighbouring ids apart. */
export function paperStyle(id: number) {
  const [light, night] = PAPERS[(id * 3) % PAPERS.length];
  return { '--paper': light, '--paper-night': night } as CSSProperties;
}
