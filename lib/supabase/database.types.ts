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
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_rides: {
        Row: {
          created_at: string
          created_by: string
          group_id: string
          id: string
          route_id: string | null
          scheduled_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          route_id?: string | null
          scheduled_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          route_id?: string | null
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_rides_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_rides_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_rides_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          pace_kmh: number
          train_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          pace_kmh: number
          train_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          pace_kmh?: number
          train_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avg_pace_kmh: number
          bike: Json | null
          id: string
          name: string
          skill_level: string
          updated_at: string
          weekly_ride_goal: number
        }
        Insert: {
          avatar_url?: string | null
          avg_pace_kmh?: number
          bike?: Json | null
          id: string
          name?: string
          skill_level?: string
          updated_at?: string
          weekly_ride_goal?: number
        }
        Update: {
          avatar_url?: string | null
          avg_pace_kmh?: number
          bike?: Json | null
          id?: string
          name?: string
          skill_level?: string
          updated_at?: string
          weekly_ride_goal?: number
        }
        Relationships: []
      }
      rides: {
        Row: {
          avg_speed_kmh: number
          created_at: string
          destination: Json | null
          distance_meters: number
          drafting_fraction: number
          duration_sec: number
          ended_at: string
          energy_saved_percent: number
          energy_saved_watts: number
          id: string
          max_speed_kmh: number
          origin: Json | null
          potential_extra_energy_percent: number
          route_name: string | null
          samples: Json
          segments: Json
          started_at: string
          user_id: string
        }
        Insert: {
          avg_speed_kmh: number
          created_at?: string
          destination?: Json | null
          distance_meters: number
          drafting_fraction: number
          duration_sec: number
          ended_at: string
          energy_saved_percent: number
          energy_saved_watts: number
          id?: string
          max_speed_kmh: number
          origin?: Json | null
          potential_extra_energy_percent: number
          route_name?: string | null
          samples?: Json
          segments?: Json
          started_at: string
          user_id: string
        }
        Update: {
          avg_speed_kmh?: number
          created_at?: string
          destination?: Json | null
          distance_meters?: number
          drafting_fraction?: number
          duration_sec?: number
          ended_at?: string
          energy_saved_percent?: number
          energy_saved_watts?: number
          id?: string
          max_speed_kmh?: number
          origin?: Json | null
          potential_extra_energy_percent?: number
          route_name?: string | null
          samples?: Json
          segments?: Json
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          difficulty: string
          distance_km: number
          draft_percent: number
          id: string
          name: string
          note: string | null
          pace_kmh: number
          riders: number
          shape: string
          traffic: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          distance_km: number
          draft_percent: number
          id: string
          name: string
          note?: string | null
          pace_kmh: number
          riders?: number
          shape: string
          traffic: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          distance_km?: number
          draft_percent?: number
          id?: string
          name?: string
          note?: string | null
          pace_kmh?: number
          riders?: number
          shape?: string
          traffic?: string
        }
        Relationships: []
      }
    }
    Views: {
      groups_with_counts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          member_count: number | null
          name: string | null
          owner_id: string | null
          pace_kmh: number | null
          train_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_group_member: { Args: { gid: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
