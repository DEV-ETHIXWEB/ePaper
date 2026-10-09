export interface Publication {
  id: number;
  slug: string;
  name: string;
  name_local: string | null;
  language: "pa" | "hi" | "en";
  region: string | null;
  /** Masthead family, so nine titles group instead of forming one flat grid. */
  group_name: string | null;
  sort_order: number;
  is_active: 0 | 1;
  created_at: string;
}

export type IssueStatus = "processing" | "ready" | "failed";

export interface Issue {
  id: number;
  publication_id: number;
  publish_date: string;
  status: IssueStatus;
  page_count: number;
  source_key: string | null;
  error: string | null;
  created_at: string;
  published_at: string | null;
}

export interface Page {
  id: number;
  issue_id: number;
  page_number: number;
  width: number;
  height: number;
  storage_prefix: string;
  created_at: string;
}

export interface Clip {
  id: string;
  page_id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  storage_key: string | null;
  created_at: string;
}

/** An issue joined with the publication it belongs to, for listing screens. */
export interface IssueWithPublication extends Issue {
  publication_slug: string;
  publication_name: string;
  publication_name_local: string | null;
  publication_language: Publication["language"];
}
