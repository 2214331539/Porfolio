export type Screenshot = { src: string; alt: string };
export type ProjectInput = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  icon_key: 'default' | 'couploc' | 'soundtag' | 'cooking' | 'impromptu' | 'shopify';
  icon_url: string;
  screenshots: Screenshot[];
  url: string;
  link_label: string;
  keywords: string[];
  status: 'draft' | 'published';
  sort_order: number;
};
export type Project = ProjectInput & { id: number };
export type PortfolioProfile = { title: string; introduction: string };
export type Portfolio = { profile: PortfolioProfile; projects: Project[] };