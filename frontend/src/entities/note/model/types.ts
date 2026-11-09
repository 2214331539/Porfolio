import type { ContentRepository } from '../../repository/model/types';

export type Note = {
  id: number;
  title: string;
  content: string;
  images: string[];
  topics: string[];
  repository?: ContentRepository | null;
  repository_id?: number | null;
  status: 'draft' | 'published';
  is_pinned: boolean;
  views: number;
  likes: number;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type NoteInput = Partial<Omit<Note, 'repository'>>;
