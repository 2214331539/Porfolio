import type { ContentRepository } from '../../repository/model/types';

export type Category = { id: number; name: string; slug: string; description?: string };
export type Tag = { id: number; name: string; slug: string };
export type PostStatus = 'draft' | 'published';

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_url?: string | null;
  category?: Category | null;
  category_id?: number | null;
  repository?: ContentRepository | null;
  repository_id?: number | null;
  tags: Tag[];
  tag_names?: string[];
  status: PostStatus;
  is_pinned: boolean;
  is_private: boolean;
  views: number;
  reading_time: number;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type PostInput = Partial<Omit<Post, 'tags' | 'repository' | 'category'>> & { tag_names?: string[] };
