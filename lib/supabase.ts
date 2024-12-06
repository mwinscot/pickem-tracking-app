import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          picks_remaining: number
          points: number
          created_at: string
        }
        Insert: {
          id: string
          email: string
          picks_remaining?: number
          points?: number
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          picks_remaining?: number
          points?: number
          created_at?: string
        }
      }
      picks: {
        Row: {
          id: string
          user_id: string
          game_id: string
          team: string
          spread: number
          is_favorite: boolean
          status: 'pending' | 'win' | 'loss' | 'tie'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          game_id: string
          team: string
          spread: number
          is_favorite: boolean
          status?: 'pending' | 'win' | 'loss' | 'tie'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_id?: string
          team?: string
          spread?: number
          is_favorite?: boolean
          status?: 'pending' | 'win' | 'loss' | 'tie'
          created_at?: string
        }
      }
      games: {
        Row: {
          id: string
          home_team: string
          away_team: string
          home_score: number | null
          away_score: number | null
          status: 'scheduled' | 'in_progress' | 'final'
          start_time: string
          created_at: string
        }
        Insert: {
          id: string
          home_team: string
          away_team: string
          home_score?: number | null
          away_score?: number | null
          status?: 'scheduled' | 'in_progress' | 'final'
          start_time: string
          created_at?: string
        }
        Update: {
          id?: string
          home_team?: string
          away_team?: string
          home_score?: number | null
          away_score?: number | null
          status?: 'scheduled' | 'in_progress' | 'final'
          start_time?: string
          created_at?: string
        }
      }
    }
  }
}