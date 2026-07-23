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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_login: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          summary: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_login?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          summary: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_login?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          data: Json
          id: number
          updated_at: string
        }
        Insert: {
          data: Json
          id?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number
          amount_override: boolean
          check_in_at: string | null
          check_out_at: string | null
          child_name: string
          client_id: string | null
          created_at: string
          extra_services: string[]
          format: string
          hours: number | null
          id: string
          parent_comment: string | null
          parent_summary: string | null
          parent_name: string
          payment_status: string
          phone: string | null
          phone_normalized: string | null
          source: string | null
          status: string
          teacher_comment: string | null
          updated_at: string
          visit_date: string
          visit_time: string | null
        }
        Insert: {
          amount?: number
          amount_override?: boolean
          check_in_at?: string | null
          check_out_at?: string | null
          child_name: string
          client_id?: string | null
          created_at?: string
          extra_services?: string[]
          format: string
          hours?: number | null
          id?: string
          parent_comment?: string | null
          parent_summary?: string | null
          parent_name: string
          payment_status?: string
          phone?: string | null
          phone_normalized?: string | null
          source?: string | null
          status?: string
          teacher_comment?: string | null
          updated_at?: string
          visit_date: string
          visit_time?: string | null
        }
        Update: {
          amount?: number
          amount_override?: boolean
          check_in_at?: string | null
          check_out_at?: string | null
          child_name?: string
          client_id?: string | null
          created_at?: string
          extra_services?: string[]
          format?: string
          hours?: number | null
          id?: string
          parent_comment?: string | null
          parent_summary?: string | null
          parent_name?: string
          payment_status?: string
          phone?: string | null
          phone_normalized?: string | null
          source?: string | null
          status?: string
          teacher_comment?: string | null
          updated_at?: string
          visit_date?: string
          visit_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          admin_comment: string | null
          adaptation_notes: string | null
          attention_label: string | null
          child_birthdate: string | null
          child_name: string
          calming_notes: string | null
          created_at: string
          food_allergies: string | null
          hygiene_notes: string | null
          id: string
          important_notes: string | null
          interests: string | null
          other_allergies: string | null
          parent_name: string
          parent_questionnaire: string | null
          photo_consent: string | null
          photo_url: string | null
          physical_restrictions: string | null
          preferred_name: string | null
          phone: string | null
          phone_normalized: string | null
          snack_consent: string | null
          teacher_comment: string | null
          toilet_habits: string | null
          updated_at: string
          who_can_pickup: string | null
        }
        Insert: {
          admin_comment?: string | null
          adaptation_notes?: string | null
          attention_label?: string | null
          child_birthdate?: string | null
          child_name: string
          calming_notes?: string | null
          created_at?: string
          food_allergies?: string | null
          hygiene_notes?: string | null
          id?: string
          important_notes?: string | null
          interests?: string | null
          other_allergies?: string | null
          parent_name: string
          parent_questionnaire?: string | null
          photo_consent?: string | null
          photo_url?: string | null
          physical_restrictions?: string | null
          preferred_name?: string | null
          phone?: string | null
          phone_normalized?: string | null
          snack_consent?: string | null
          teacher_comment?: string | null
          toilet_habits?: string | null
          updated_at?: string
          who_can_pickup?: string | null
        }
        Update: {
          admin_comment?: string | null
          adaptation_notes?: string | null
          attention_label?: string | null
          child_birthdate?: string | null
          child_name?: string
          calming_notes?: string | null
          created_at?: string
          food_allergies?: string | null
          hygiene_notes?: string | null
          id?: string
          important_notes?: string | null
          interests?: string | null
          other_allergies?: string | null
          parent_name?: string
          parent_questionnaire?: string | null
          photo_consent?: string | null
          photo_url?: string | null
          physical_restrictions?: string | null
          preferred_name?: string | null
          phone?: string | null
          phone_normalized?: string | null
          snack_consent?: string | null
          teacher_comment?: string | null
          toilet_habits?: string | null
          updated_at?: string
          who_can_pickup?: string | null
        }
        Relationships: []
      }
      expense_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          receipt_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          receipt_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          receipt_date?: string
        }
        Relationships: []
      }
      solo_insights: {
        Row: {
          activity: string
          ask: string
          client_id: string
          generated_at: string
          remember: string
          source_booking_ids: string[]
          source_hash: string
          updated_at: string
          watch_out: string
        }
        Insert: {
          activity: string
          ask: string
          client_id: string
          generated_at?: string
          remember: string
          source_booking_ids?: string[]
          source_hash: string
          updated_at?: string
          watch_out: string
        }
        Update: {
          activity?: string
          ask?: string
          client_id?: string
          generated_at?: string
          remember?: string
          source_booking_ids?: string[]
          source_hash?: string
          updated_at?: string
          watch_out?: string
        }
        Relationships: [
          {
            foreignKeyName: "solo_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
