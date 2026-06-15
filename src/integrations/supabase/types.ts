export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      futures_picks: {
        Row: {
          created_at: string;
          golden_boot: string | null;
          id: string;
          locked: boolean;
          most_assists: string | null;
          semi_finalists: string[] | null;
          updated_at: string;
          user_id: string;
          winner: string | null;
        };
        Insert: {
          created_at?: string;
          golden_boot?: string | null;
          id?: string;
          locked?: boolean;
          most_assists?: string | null;
          semi_finalists?: string[] | null;
          updated_at?: string;
          user_id: string;
          winner?: string | null;
        };
        Update: {
          created_at?: string;
          golden_boot?: string | null;
          id?: string;
          locked?: boolean;
          most_assists?: string | null;
          semi_finalists?: string[] | null;
          updated_at?: string;
          user_id?: string;
          winner?: string | null;
        };
        Relationships: [];
      };
      match_odds: {
        Row: {
          bookmaker: string | null;
          created_at: string;
          id: string;
          locked: boolean;
          match_id: string;
          odds_1: number | null;
          odds_2: number | null;
          odds_x: number | null;
          snapshot_at: string | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          bookmaker?: string | null;
          created_at?: string;
          id?: string;
          locked?: boolean;
          match_id: string;
          odds_1?: number | null;
          odds_2?: number | null;
          odds_x?: number | null;
          snapshot_at?: string | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          bookmaker?: string | null;
          created_at?: string;
          id?: string;
          locked?: boolean;
          match_id?: string;
          odds_1?: number | null;
          odds_2?: number | null;
          odds_x?: number | null;
          snapshot_at?: string | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_odds_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          api_fixture_id: string | null;
          away_score: number | null;
          away_score_ht: number | null;
          away_team: string;
          created_at: string;
          group_code: string | null;
          home_score: number | null;
          home_score_ht: number | null;
          home_team: string;
          id: string;
          kickoff_at: string;
          match_key: string;
          matchday: string | null;
          stage: string;
          status: string;
          updated_at: string;
          venue: string | null;
          winner: string | null;
        };
        Insert: {
          api_fixture_id?: string | null;
          away_score?: number | null;
          away_score_ht?: number | null;
          away_team: string;
          created_at?: string;
          group_code?: string | null;
          home_score?: number | null;
          home_score_ht?: number | null;
          home_team: string;
          id?: string;
          kickoff_at: string;
          match_key: string;
          matchday?: string | null;
          stage: string;
          status?: string;
          updated_at?: string;
          venue?: string | null;
          winner?: string | null;
        };
        Update: {
          api_fixture_id?: string | null;
          away_score?: number | null;
          away_score_ht?: number | null;
          away_team?: string;
          created_at?: string;
          group_code?: string | null;
          home_score?: number | null;
          home_score_ht?: number | null;
          home_team?: string;
          id?: string;
          kickoff_at?: string;
          match_key?: string;
          matchday?: string | null;
          stage?: string;
          status?: string;
          updated_at?: string;
          venue?: string | null;
          winner?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_away_team_fkey";
            columns: ["away_team"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["name"];
          },
          {
            foreignKeyName: "matches_home_team_fkey";
            columns: ["home_team"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["name"];
          },
        ];
      };
      predictions: {
        Row: {
          away_score: number | null;
          created_at: string;
          home_score: number | null;
          id: string;
          match_id: string;
          pick: string | null;
          points: number;
          updated_at: string;
          user_id: string;
          winner: string | null;
        };
        Insert: {
          away_score?: number | null;
          created_at?: string;
          home_score?: number | null;
          id?: string;
          match_id: string;
          pick?: string | null;
          points?: number;
          updated_at?: string;
          user_id: string;
          winner?: string | null;
        };
        Update: {
          away_score?: number | null;
          created_at?: string;
          home_score?: number | null;
          id?: string;
          match_id?: string;
          pick?: string | null;
          points?: number;
          updated_at?: string;
          user_id?: string;
          winner?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          username?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          created_at: string;
          flag_emoji: string | null;
          group_code: string | null;
          name: string;
        };
        Insert: {
          created_at?: string;
          flag_emoji?: string | null;
          group_code?: string | null;
          name: string;
        };
        Update: {
          created_at?: string;
          flag_emoji?: string | null;
          group_code?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      tournament_results: {
        Row: {
          golden_boot: string | null;
          id: number;
          most_assists: string | null;
          semi_finalists: string[] | null;
          winner: string | null;
        };
        Insert: {
          golden_boot?: string | null;
          id?: number;
          most_assists?: string | null;
          semi_finalists?: string[] | null;
          winner?: string | null;
        };
        Update: {
          golden_boot?: string | null;
          id?: number;
          most_assists?: string | null;
          semi_finalists?: string[] | null;
          winner?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_knockout_multiplier: { Args: { stage: string }; Returns: number };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      recompute_predictions_for_match: {
        Args: { _match_id: string };
        Returns: undefined;
      };
      score_pick: {
        Args: { actual_away: number; actual_home: number; pred_pick: string };
        Returns: number;
      };
      score_pick_odds: {
        Args: {
          actual_away: number;
          actual_home: number;
          match_stage: string;
          odds_1: number;
          odds_2: number;
          odds_x: number;
          pred_pick: string;
        };
        Returns: number;
      };
      score_prediction: {
        Args: {
          actual_away: number;
          actual_home: number;
          pred_away: number;
          pred_home: number;
        };
        Returns: number;
      };
    };
    Enums: {
      app_role: "admin" | "player";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "player"],
    },
  },
} as const;
