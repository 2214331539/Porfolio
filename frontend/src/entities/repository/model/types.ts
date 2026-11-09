export type RepositoryContentType = 'post' | 'note';

export type ContentRepository = {
  id: number;
  name: string;
  slug: string;
  description: string;
  content_type: RepositoryContentType;
  parent_id: number | null;
  sort_order: number;
  item_count: number;
  child_count: number;
};

export type RepositoryInput = Pick<ContentRepository, 'name' | 'content_type'> &
  Partial<Pick<ContentRepository, 'description' | 'parent_id' | 'sort_order' | 'slug'>> & { id?: number };
