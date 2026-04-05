export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      cases: {
        Row: {
          id: string;
          attorney_id: string;
          case_code: string;
          jurisdiction: string;
          status: string;
          severity_score: number | null;
          message_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attorney_id: string;
          case_code: string;
          jurisdiction: string;
          status?: string;
          severity_score?: number | null;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attorney_id?: string;
          case_code?: string;
          jurisdiction?: string;
          status?: string;
          severity_score?: number | null;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          case_id: string;
          sent_at: string;
          sender_role: string;
          body_text: string;
          platform_source: string;
          raw_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          sent_at: string;
          sender_role: string;
          body_text: string;
          platform_source: string;
          raw_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          sent_at?: string;
          sender_role?: string;
          body_text?: string;
          platform_source?: string;
          raw_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      behavioral_flags: {
        Row: {
          id: string;
          case_id: string;
          message_id: string;
          indicator_category: string;
          confidence: string;
          reasoning_text: string;
          quoted_excerpt: string | null;
          attorney_status: string;
          reclassified_as: string | null;
          claude_model_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          message_id: string;
          indicator_category: string;
          confidence: string;
          reasoning_text: string;
          quoted_excerpt?: string | null;
          attorney_status?: string;
          reclassified_as?: string | null;
          claude_model_version: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          message_id?: string;
          indicator_category?: string;
          confidence?: string;
          reasoning_text?: string;
          quoted_excerpt?: string | null;
          attorney_status?: string;
          reclassified_as?: string | null;
          claude_model_version?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "behavioral_flags_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "behavioral_flags_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      exports: {
        Row: {
          id: string;
          case_id: string;
          export_type: string;
          file_path: string;
          watermarked: boolean;
          attorney_acknowledged: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          export_type: string;
          file_path: string;
          watermarked?: boolean;
          attorney_acknowledged?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          export_type?: string;
          file_path?: string;
          watermarked?: boolean;
          attorney_acknowledged?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exports_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string;
          case_id: string | null;
          action_type: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          case_id?: string | null;
          action_type: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          case_id?: string | null;
          action_type?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
