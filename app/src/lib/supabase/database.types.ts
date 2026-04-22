// Database types for Coolshi. Hand-written stub matching supabase/schema.sql.
// Regenerate with `npx supabase gen types typescript --project-id <id>` when the schema evolves.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SourceTier = "A" | "B" | "C" | "D";
export type CardType = "news" | "deep_dive";
export type FeedbackSignal = "like" | "dislike" | "neutral" | "skip";

export type CardSource = {
  url: string;
  name: string;
};

export type FeedCardRow = {
  id: string;
  title: string;
  synthesis: string;
  sources: CardSource[];
  divergence_notes: string | null;
  tags: string[] | null;
  card_type: CardType;
  importance_score: number | null;
  batch_id: string;
  hero_image_url: string | null;
  created_at: string;
};

export type BriefRow = {
  id: string;
  content: string;
  anchor_articles: Json;
  is_active: boolean;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  card_id: string;
  signal: FeedbackSignal;
  dwell_ms: number | null;
  created_at: string;
};

export type AgentRunRow = {
  id: string;
  batch_id: string;
  topics_covered: string[] | null;
  sources_consulted: string[] | null;
  raw_items_ingested: number | null;
  findings: Json;
  cards_produced: number | null;
  tokens_used: number | null;
  started_at: string;
  ended_at: string | null;
};

export type SourceRow = {
  id: string;
  source_type: string;
  source_tier: SourceTier | null;
  name: string;
  config: Json;
  is_active: boolean | null;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      feed_cards: {
        Row: FeedCardRow;
        Insert: Omit<FeedCardRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<FeedCardRow>;
        Relationships: [];
      };
      briefs: {
        Row: BriefRow;
        Insert: Omit<BriefRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<BriefRow>;
        Relationships: [];
      };
      feedback: {
        Row: FeedbackRow;
        Insert: {
          card_id: string;
          signal: FeedbackSignal;
          dwell_ms: number | null;
          id?: string;
          created_at?: string;
        };
        Update: Partial<FeedbackRow>;
        Relationships: [];
      };
      agent_runs: {
        Row: AgentRunRow;
        Insert: Omit<AgentRunRow, "id" | "started_at"> & {
          id?: string;
          started_at?: string;
        };
        Update: Partial<AgentRunRow>;
        Relationships: [];
      };
      sources: {
        Row: SourceRow;
        Insert: Omit<SourceRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<SourceRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
