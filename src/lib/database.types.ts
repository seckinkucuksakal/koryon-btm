export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_reports: {
        Row: {
          created_at: string
          deleted_at: string | null
          humidity: string | null
          id: string
          important_notes: string | null
          report_date: string
          report_no: number | null
          temperature: string | null
          today_tasks: Json
          tomorrow_tasks: Json
          updated_at: string
          user_id: string | null
          visible: boolean
          weather: string | null
          wind: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          humidity?: string | null
          id?: string
          important_notes?: string | null
          report_date: string
          report_no?: number | null
          temperature?: string | null
          today_tasks?: Json
          tomorrow_tasks?: Json
          updated_at?: string
          user_id?: string | null
          visible?: boolean
          weather?: string | null
          wind?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          humidity?: string | null
          id?: string
          important_notes?: string | null
          report_date?: string
          report_no?: number | null
          temperature?: string | null
          today_tasks?: Json
          tomorrow_tasks?: Json
          updated_at?: string
          user_id?: string | null
          visible?: boolean
          weather?: string | null
          wind?: string | null
        }
        Relationships: []
      }
      drawings: {
        Row: {
          created_at: string
          data: Json | null
          deleted_at: string | null
          id: string
          kind: string
          panel_id: string | null
          room_id: string | null
          storage_path: string
          title: string | null
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          kind?: string
          panel_id?: string | null
          room_id?: string | null
          storage_path: string
          title?: string | null
          user_id?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          kind?: string
          panel_id?: string | null
          room_id?: string | null
          storage_path?: string
          title?: string | null
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      equipment: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          panel_id: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          panel_id: string
          user_id?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          panel_id?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "equipment_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panel_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          room_id: string
          user_id: string
          visible: boolean
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          room_id: string
          user_id?: string
          visible?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          room_id?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      panels: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          panel_type: string
          room_id: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          panel_type: string
          room_id: string
          user_id?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          panel_type?: string
          room_id?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "panels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          panel_id: string | null
          room_id: string | null
          storage_path: string
          title: string | null
          user_id: string
          visible: boolean
          width: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          panel_id?: string | null
          room_id?: string | null
          storage_path: string
          title?: string | null
          user_id?: string
          visible?: boolean
          width?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          panel_id?: string | null
          room_id?: string | null
          storage_path?: string
          title?: string | null
          user_id?: string
          visible?: boolean
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panel_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          room_name: string
          unit_id: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          room_name: string
          unit_id: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          room_name?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      panel_stats: {
        Row: {
          created_at: string | null
          drawing_count: number | null
          equipment_count: number | null
          id: string | null
          name: string | null
          notes: string | null
          panel_type: string | null
          photo_count: number | null
          room_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          drawing_count?: never
          equipment_count?: never
          id?: string | null
          name?: string | null
          notes?: string | null
          panel_type?: string | null
          photo_count?: never
          room_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          drawing_count?: never
          equipment_count?: never
          id?: string | null
          name?: string | null
          notes?: string | null
          panel_type?: string | null
          photo_count?: never
          room_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_stats: {
        Row: {
          created_at: string | null
          description: string | null
          drawing_count: number | null
          id: string | null
          note_count: number | null
          panel_count: number | null
          photo_count: number | null
          room_name: string | null
          unit_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          drawing_count?: never
          id?: string | null
          note_count?: never
          panel_count?: never
          photo_count?: never
          room_name?: string | null
          unit_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          drawing_count?: never
          id?: string | null
          note_count?: never
          panel_count?: never
          photo_count?: never
          room_name?: string | null
          unit_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_stats: {
        Row: {
          created_at: string | null
          description: string | null
          drawing_count: number | null
          id: string | null
          name: string | null
          panel_count: number | null
          photo_count: number | null
          room_count: number | null
          sort_order: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          drawing_count?: never
          id?: string | null
          name?: string | null
          panel_count?: never
          photo_count?: never
          room_count?: never
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          drawing_count?: never
          id?: string | null
          name?: string | null
          panel_count?: never
          photo_count?: never
          room_count?: never
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
