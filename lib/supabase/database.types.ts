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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      boss_awards: {
        Row: {
          awarded_at: string
          boss: string
          game_id: string
          id: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          boss: string
          game_id: string
          id?: never
          user_id: string
        }
        Update: {
          awarded_at?: string
          boss?: string
          game_id?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_awards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          balance: number
          last_award_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          last_award_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          last_award_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          cat: string
          color: string
          cover: string
          created_at: string
          id: string
          long: string
          origin: string
          short: string
          title: string
        }
        Insert: {
          cat: string
          color: string
          cover: string
          created_at?: string
          id: string
          long: string
          origin: string
          short: string
          title: string
        }
        Update: {
          cat?: string
          color?: string
          cover?: string
          created_at?: string
          id?: string
          long?: string
          origin?: string
          short?: string
          title?: string
        }
        Relationships: []
      }
      pins: {
        Row: {
          game_id: string
          id: string
          kind: string
          name: string
          number: number
          rarity: string
        }
        Insert: {
          game_id: string
          id: string
          kind: string
          name: string
          number: number
          rarity: string
        }
        Update: {
          game_id?: string
          id?: string
          kind?: string
          name?: string
          number?: number
          rarity?: string
        }
        Relationships: [
          {
            foreignKeyName: "pins_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ban_reason: string | null
          banned: boolean
          banned_at: string | null
          created_at: string
          id: string
        }
        Insert: {
          ban_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          created_at?: string
          id: string
        }
        Update: {
          ban_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          created_at: string
          game_id: string
          id: number
          name: string
          score: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: never
          name: string
          score: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: never
          name?: string
          score?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pins: {
        Row: {
          obtained_at: string
          pin_id: string
          user_id: string
        }
        Insert: {
          obtained_at?: string
          pin_id: string
          user_id: string
        }
        Update: {
          obtained_at?: string
          pin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pins_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_boss_credit: {
        Args: { p_boss: string; p_game_id: string }
        Returns: Json
      }
      award_credit: {
        Args: { p_game_id: string; p_score: number; p_seconds: number }
        Returns: Json
      }
      pull_pin: { Args: { p_cost: number }; Returns: Json }
      royalty_of_games: {
        Args: { p_limit?: number }
        Returns: {
          games: number
          last_at: string
          name: string
          rank: number
          total: number
        }[]
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
