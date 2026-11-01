/**
 * Типы схемы БД для типизированного клиента Supabase.
 * Описаны вручную по supabase/migrations/20261101000000_init_schema.sql.
 * Когда появится проект Supabase, файл можно перегенерировать:
 *   npx supabase gen types typescript --linked > src/shared/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          steam_id: string;
          created_at: string;
        };
        // Клиент не создаёт и не меняет профиль (это делает Edge Function), см. RLS.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          user_id: string;
          appid: number;
          name: string;
          cover_url: string | null;
          genres: string[];
          playtime: number;
          created_at: string;
          updated_at: string;
          /** Последний запуск в Steam (rtime_last_played). */
          last_played_at: string | null;
          /** Когда игру искали в RAWG (пишет только Edge Function rawg-enrich). */
          rawg_checked_at: string | null;
        };
        Insert: {
          user_id: string;
          appid: number;
          name: string;
          cover_url?: string | null;
          genres?: string[];
          playtime?: number;
        };
        Update: {
          name?: string;
          cover_url?: string | null;
          genres?: string[];
          playtime?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'games_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      play_sessions: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          user_id: string;
          game_id: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'play_sessions_game_id_user_id_fkey';
            columns: ['game_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type PublicTables = Database['public']['Tables'];
export type TableRow<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TableInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type TableUpdate<T extends keyof PublicTables> = PublicTables[T]['Update'];
