export type InfoSource = {
  id: number;
  name: string;
  url: string;
  description: string;
  category: string;
  color: string;
  icon_url: string;
  weight: number;
  sort_order: number;
  is_visible: boolean;
};

export type InfoSourceInput = Omit<InfoSource, 'id'>;
