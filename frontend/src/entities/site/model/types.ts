import type { Post } from '../../post/model/types';

export type SiteSettings = {
  site_title: string;
  site_description: string;
  hero_kicker: string;
  mottos: string[];
  footer_text: string;
  icp_number: string;
  github_url: string;
  github_handle: string;
  email: string;
  wechat_handle: string;
  wechat_url: string;
  douyin_handle: string;
  douyin_url: string;
  xiaohongshu_handle: string;
  xiaohongshu_url: string;
};

export type Dashboard = {
  posts: number;
  notes: number;
  views: number;
  published: number;
  recent_posts: Post[];
};
