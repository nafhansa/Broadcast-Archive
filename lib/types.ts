import type { CategoryKey } from "./categories";
import type { LinkItem } from "./telegram/parse";

export type MediaItem = { path: string; url: string; width?: number; height?: number; mime: string };

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  category: CategoryKey;
  category_source: "rule" | "ai" | "manual";
  ai_model: string | null;
  ai_confidence: number | null;
  links: LinkItem[];
  media: MediaItem[];
  source_group: string | null;
  sender: string | null;
  deadline: string | null;
  status: "published" | "hidden";
  pinned: boolean;
  received_at: string;
  created_at: string;
  updated_at: string;
};

export type FeedParams = { cat?: string; q?: string };

export type Pojok = {
  id: string;
  slug: string;
  title: string;
  question: string;
  description: string | null;
  is_open: boolean;
  is_visible: boolean;
  max_length: number;
  sort_order: number;
  created_at: string;
};

export type CloudEntry = { normalized: string; display_text: string; n: number };
