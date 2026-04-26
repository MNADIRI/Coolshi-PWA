// Database types for Coolshi. Hand-written stub matching supabase/schema.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
  long_form: string | null;
  sources: CardSource[];
  divergence_notes: string | null;
  tags: string[] | null;
  card_type: CardType;
  importance_score: number | null;
  batch_id: string;
  hero_image_url: string | null;
  is_reserve: boolean;
  released_at: string | null;
  delivered_at: string | null;
  user_id: string | null;
  public_slug: string;
  is_public: boolean;
  created_at: string;
};

export type BriefLanguage = "en" | "fr";

export type BriefRow = {
  id: string;
  content: string | null;
  anchor_articles: Json;
  is_active: boolean;
  location: string | null;
  international_scope: number | null;
  recency_days: number | null;
  expertise_level: number | null;
  interests: string | null;
  preferences: string | null;
  must_not_miss: string | null;
  am_delivery_time: string;
  pm_delivery_time: string;
  timezone: string;
  language: BriefLanguage;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedCardRow = {
  card_id: string;
  saved_at: string;
  user_id: string | null;
};

export type ManualBatchStatus = "in_progress" | "completed" | "failed";
export type ManualBatchJobRow = {
  id: string;
  requested_for_date: string;
  requested_at: string;
  status: ManualBatchStatus;
  batch_id: string | null;
  error_message: string | null;
  completed_at: string | null;
  notified_at: string | null;
  user_id: string | null;
};

export type FeedbackRow = {
  id: string;
  card_id: string;
  signal: FeedbackSignal;
  dwell_ms: number | null;
  user_id: string | null;
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
  user_id: string | null;
};

export type PendingRunStatus = "pending" | "processing" | "completed" | "failed";
export type PendingRunSlot = "am" | "pm" | "manual";
export type PendingRunRow = {
  id: string;
  user_id: string;
  slot: PendingRunSlot | null;
  status: PendingRunStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  batch_id: string | null;
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
        Insert: Partial<BriefRow> & { user_id: string };
        Update: Partial<BriefRow>;
        Relationships: [];
      };
      feedback: {
        Row: FeedbackRow;
        Insert: {
          card_id: string;
          signal: FeedbackSignal;
          dwell_ms: number | null;
          user_id?: string | null;
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
      saved_cards: {
        Row: SavedCardRow;
        Insert: { card_id: string; user_id?: string | null; saved_at?: string };
        Update: Partial<SavedCardRow>;
        Relationships: [];
      };
      manual_batch_jobs: {
        Row: ManualBatchJobRow;
        Insert: Partial<ManualBatchJobRow>;
        Update: Partial<ManualBatchJobRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          user_id: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          user_id?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: Partial<{
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          user_id: string | null;
          created_at: string;
          last_used_at: string | null;
        }>;
        Relationships: [];
      };
      pending_runs: {
        Row: PendingRunRow;
        Insert: Partial<PendingRunRow> & { user_id: string };
        Update: Partial<PendingRunRow>;
        Relationships: [];
      };
      coolshi_allowed_emails: {
        Row: { email: string; added_at: string };
        Insert: { email: string; added_at?: string };
        Update: Partial<{ email: string; added_at: string }>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
