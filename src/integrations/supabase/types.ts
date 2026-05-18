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
      activity_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          meta: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          meta?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          meta?: Json | null
        }
        Relationships: []
      }
      analytics_snapshots: {
        Row: {
          degraded_count: number
          id: string
          offline_count: number
          online_count: number
          open_tickets: number
          snapshot_at: string
        }
        Insert: {
          degraded_count?: number
          id?: string
          offline_count?: number
          online_count?: number
          open_tickets?: number
          snapshot_at?: string
        }
        Update: {
          degraded_count?: number
          id?: string
          offline_count?: number
          online_count?: number
          open_tickets?: number
          snapshot_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      cloud_status: {
        Row: {
          id: number
          last_check: string
          latency_ms: number
          service: string
          status: string
        }
        Insert: {
          id?: number
          last_check?: string
          latency_ms?: number
          service?: string
          status?: string
        }
        Update: {
          id?: number
          last_check?: string
          latency_ms?: number
          service?: string
          status?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          config_hash: string | null
          id: string
          last_seen: string
          last_status_check_at: string | null
          mac_address: string | null
          name: string
          ruijie_device_id: string | null
          school_id: string
          status: string
          type: string
          uptime_pct: number | null
        }
        Insert: {
          config_hash?: string | null
          id?: string
          last_seen?: string
          last_status_check_at?: string | null
          mac_address?: string | null
          name: string
          ruijie_device_id?: string | null
          school_id: string
          status?: string
          type: string
          uptime_pct?: number | null
        }
        Update: {
          config_hash?: string | null
          id?: string
          last_seen?: string
          last_status_check_at?: string | null
          mac_address?: string | null
          name?: string
          ruijie_device_id?: string | null
          school_id?: string
          status?: string
          type?: string
          uptime_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_windows: {
        Row: {
          created_at: string
          created_by: string | null
          end_at: string
          id: string
          reason: string | null
          school_id: string
          start_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_at: string
          id?: string
          reason?: string | null
          school_id: string
          start_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_at?: string
          id?: string
          reason?: string | null
          school_id?: string
          start_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          outage_simulation: boolean
          report_review: boolean
          sla_breached: boolean
          ticket_assigned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          outage_simulation?: boolean
          report_review?: boolean
          sla_breached?: boolean
          ticket_assigned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          outage_simulation?: boolean
          report_review?: boolean
          sla_breached?: boolean
          ticket_assigned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      schools: {
        Row: {
          created_at: string
          gateway_reachable: boolean
          id: string
          internet_check_ok: boolean
          isp_type: string | null
          last_synced_at: string | null
          last_visit_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          province: string | null
          region: string
          ruijie_site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gateway_reachable?: boolean
          id?: string
          internet_check_ok?: boolean
          isp_type?: string | null
          last_synced_at?: string | null
          last_visit_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          province?: string | null
          region: string
          ruijie_site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gateway_reachable?: boolean
          id?: string
          internet_check_ok?: boolean
          isp_type?: string | null
          last_synced_at?: string | null
          last_visit_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          province?: string | null
          region?: string
          ruijie_site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          school_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          school_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          school_id?: string
        }
        Relationships: []
      }
      teacher_reports: {
        Row: {
          created_at: string
          id: string
          linked_ticket_id: string | null
          linked_ticket_number: string | null
          message: string | null
          report_status: string
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_ticket_id?: string | null
          linked_ticket_number?: string | null
          message?: string | null
          report_status?: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_ticket_id?: string | null
          linked_ticket_number?: string | null
          message?: string | null
          report_status?: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assignee_id: string | null
          closed_at: string | null
          confidence: number | null
          created_at: string
          description: string | null
          device_ids: string[]
          id: string
          priority: string
          report_ids: string[]
          resolution_notes: string | null
          root_cause: string
          school_ids: string[]
          sla_due_at: string | null
          status: string
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          device_ids?: string[]
          id?: string
          priority: string
          report_ids?: string[]
          resolution_notes?: string | null
          root_cause: string
          school_ids?: string[]
          sla_due_at?: string | null
          status?: string
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          device_ids?: string[]
          id?: string
          priority?: string
          report_ids?: string[]
          resolution_notes?: string | null
          root_cause?: string
          school_ids?: string[]
          sla_due_at?: string | null
          status?: string
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_school_access: {
        Row: {
          created_at: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_school_access_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          alert_threshold_pct: number
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold_pct?: number
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold_pct?: number
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      bootstrap_first_admin: { Args: { _user_id: string }; Returns: boolean }
      can_access_ticket: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_ticket: {
        Args: { _school_ids: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      list_reportable_schools: {
        Args: never
        Returns: {
          id: string
          name: string
          region: string
        }[]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "technician" | "teacher"
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
    Enums: {
      app_role: ["admin", "technician", "teacher"],
    },
  },
} as const
