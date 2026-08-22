export type Note = {
  id: number;
  title: string;
  content: string;
  images: string[];
  topics: string[];
  repository?: import('../../repository/model/types').ContentRepository | null;
  repository_id?: number | null;
  status: 'draft' | 'published';
  is_pinned: boolean;
  views: number;
  likes: number;
  published_at: string;
};
