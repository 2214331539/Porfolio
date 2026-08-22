export type ResumeStatus = 'draft' | 'published';

export type ResumeVersion = {
  id: number;
  title: string;
  label: string;
  description: string;
  image_url: string;
  pdf_url?: string | null;
  version_date: string;
  status: ResumeStatus;
  is_current: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
