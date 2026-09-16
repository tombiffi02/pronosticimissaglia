export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_settings: {
        Row: {
          correct_winner_points: number
          exact_score_points: number
          league_id: string
          lock_minutes_before: number
          notifications_enabled: boolean
          updated_at: string
          wrong_winner_points: number
        }
        Insert: {
          correct_winner_points?: number
          exact_score_points?: number
          league_id: string
          lock_minutes_before?: number
          notifications_enabled?: boolean
          updated_at?: string
          wrong_winner_points?: number
        }
        Update: {
          correct_winner_points?: number
          exact_score_points?: number
          league_id?: string
          lock_minutes_before?: number
          notifications_enabled?: boolean
          updated_at?: string
          wrong_winner_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_settings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          admin_id: string
          championship: string
          created_at: string
          group_name: string | null
          id: string
          invite_code: string
          name: string
          reference_team_id: string | null
          season: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          championship: string
          created_at?: string
          group_name?: string | null
          id?: string
          invite_code: string
          name: string
          reference_team_id?: string | null
          season: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          championship?: string
          created_at?: string
          group_name?: string | null
          id?: string
          invite_code?: string
          name?: string
          reference_team_id?: string | null
          season?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_reference_team_id_fkey"
            columns: ["reference_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matchdays: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          league_id: string
          name: string | null
          number: number
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          league_id: string
          name?: string | null
          number: number
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          league_id?: string
          name?: string | null
          number?: number
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchdays_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_sets: number | null
          away_team_id: string
          created_at: string
          external_id: string | null
          home_sets: number | null
          home_team_id: string
          id: string
          league_id: string
          match_date: string
          match_time: string | null
          matchday_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_sets?: number | null
          away_team_id: string
          created_at?: string
          external_id?: string | null
          home_sets?: number | null
          home_team_id: string
          id?: string
          league_id: string
          match_date: string
          match_time?: string | null
          matchday_id: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          away_sets?: number | null
          away_team_id?: string
          created_at?: string
          external_id?: string | null
          home_sets?: number | null
          home_team_id?: string
          id?: string
          league_id?: string
          match_date?: string
          match_time?: string | null
          matchday_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_history: {
        Row: {
          away_sets: number
          created_at: string
          home_sets: number
          id: string
          match_id: string
          prediction_id: string
          user_id: string
        }
        Insert: {
          away_sets: number
          created_at?: string
          home_sets: number
          id?: string
          match_id: string
          prediction_id: string
          user_id: string
        }
        Update: {
          away_sets?: number
          created_at?: string
          home_sets?: number
          id?: string
          match_id?: string
          prediction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_history_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_sets: number
          created_at: string
          home_sets: number
          id: string
          locked_at: string | null
          match_id: string
          points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          away_sets: number
          created_at?: string
          home_sets: number
          id?: string
          locked_at?: string | null
          match_id: string
          points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          away_sets?: number
          created_at?: string
          home_sets?: number
          id?: string
          locked_at?: string | null
          match_id?: string
          points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          championship: string
          created_at: string
          external_id: string | null
          group_name: string | null
          id: string
          logo_url: string | null
          name: string
          season: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          championship: string
          created_at?: string
          external_id?: string | null
          group_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          season: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          championship?: string
          created_at?: string
          external_id?: string | null
          group_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          season?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_any_league_admin: { Args: { _user_id: string }; Returns: boolean }
      is_league_admin: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_match_visible: {
        Args: { _match_id: string; _user_id: string }
        Returns: boolean
      }
      is_reference_team_match: { Args: { _match_id: string }; Returns: boolean }
      join_league_by_code: { Args: { _invite_code: string }; Returns: string }
      match_board: {
        Args: { _league_id: string }
        Returns: {
          away_sets: number
          away_team_id: string
          away_team_name: string
          home_sets: number
          home_team_id: string
          home_team_name: string
          is_locked: boolean
          is_reference_match: boolean
          lock_at: string
          match_date: string
          match_id: string
          match_time: string
          matchday_id: string
          matchday_name: string
          matchday_number: number
          my_away_sets: number
          my_home_sets: number
          server_now: string
          status: string
        }[]
      }
      my_prediction_history: {
        Args: { _match_id: string }
        Returns: {
          away_sets: number
          created_at: string
          home_sets: number
        }[]
      }
      prediction_lock_at: { Args: { _match_id: string }; Returns: string }
      submit_prediction: {
        Args: { _away_sets: number; _home_sets: number; _match_id: string }
        Returns: {
          away_sets: number
          created_at: string
          home_sets: number
          id: string
          locked_at: string | null
          match_id: string
          points: number | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "predictions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
