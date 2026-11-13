export type DoingKind = 'main' | 'side';

export type Doing = {
  id: number;
  title: string;
  body: string;
  /** Calendar day the thing was started, as YYYY-MM-DD. */
  started_on: string;
  kind: DoingKind;
  sort_order: number;
};

export type DoingInput = Omit<Doing, 'id' | 'sort_order'>;
