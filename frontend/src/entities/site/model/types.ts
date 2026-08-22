import type { Post } from '../../post/model/types';

export type SiteSettings = {
  site_title: string;
  site_description: string;
  hero_kicker: string;
  mottos: string[];
  footer_text: string;
  icp_number: string;
  github_url: string;
  email: string;
};

export type Dashboard = {
  posts: number;
  notes: number;
  views: number;
  published: number;
  recent_posts: Post[];
};

