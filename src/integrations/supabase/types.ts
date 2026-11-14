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
      agent_code_files: {
        Row: {
          content: string
          path: string
          size: number
          updated_at: string
        }
        Insert: {
          content: string
          path: string
          size?: number
          updated_at?: string
        }
        Update: {
          content?: string
          path?: string
          size?: number
          updated_at?: string
        }
        Relationships: []
      }
      agent_content_submissions: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          raw_json: string
          review_note: string | null
          reviewed_at: string | null
          sha256: string
          status: string
          task: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          raw_json: string
          review_note?: string | null
          reviewed_at?: string | null
          sha256: string
          status?: string
          task: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          raw_json?: string
          review_note?: string | null
          reviewed_at?: string | null
          sha256?: string
          status?: string
          task?: number
        }
        Relationships: []
      }
      agent_fixes: {
        Row: {
          created_at: string
          description: string
          files: string[]
          id: string
          patch: string
          review_note: string | null
          reviewed_at: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          files?: string[]
          id?: string
          patch: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          files?: string[]
          id?: string
          patch?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      agent_tasks: {
        Row: {
          applied_at: string | null
          board: string
          book_name: string | null
          chapter_slug: string
          chapter_title: string
          claimed_at: string | null
          created_at: string
          grade: number
          has_source: boolean
          id: number
          language: string
          source_chars: number
          source_url: string | null
          status: string
          subject: string
        }
        Insert: {
          applied_at?: string | null
          board: string
          book_name?: string | null
          chapter_slug: string
          chapter_title: string
          claimed_at?: string | null
          created_at?: string
          grade: number
          has_source?: boolean
          id?: never
          language: string
          source_chars?: number
          source_url?: string | null
          status?: string
          subject: string
        }
        Update: {
          applied_at?: string | null
          board?: string
          book_name?: string | null
          chapter_slug?: string
          chapter_title?: string
          claimed_at?: string | null
          created_at?: string
          grade?: number
          has_source?: boolean
          id?: never
          language?: string
          source_chars?: number
          source_url?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      chapter_sources: {
        Row: {
          board: string
          body: string
          body_chars: number
          chapter_slug: string
          created_at: string
          fts: unknown
          grade: number
          source_url: string
          subject: string
        }
        Insert: {
          board: string
          body: string
          body_chars?: number
          chapter_slug: string
          created_at?: string
          fts?: unknown
          grade: number
          source_url: string
          subject: string
        }
        Update: {
          board?: string
          body?: string
          body_chars?: number
          chapter_slug?: string
          created_at?: string
          fts?: unknown
          grade?: number
          source_url?: string
          subject?: string
        }
        Relationships: []
      }
      exam_chapters: {
        Row: {
          chapter_slug: string
          content: Json
          created_at: string
          exam_group: string
          grade: number
          id: string
          question_count: number
          subject: string
        }
        Insert: {
          chapter_slug: string
          content: Json
          created_at?: string
          exam_group: string
          grade: number
          id?: string
          question_count?: number
          subject: string
        }
        Update: {
          chapter_slug?: string
          content?: Json
          created_at?: string
          exam_group?: string
          grade?: number
          id?: string
          question_count?: number
          subject?: string
        }
        Relationships: []
      }
      exam_papers: {
        Row: {
          answer_source: string
          created_at: string
          exam: string
          held_on: string | null
          id: string
          key_url: string | null
          label: string
          pages: number | null
          question_count: number
          slug: string
          source_url: string
          status: string
          year: number
        }
        Insert: {
          answer_source?: string
          created_at?: string
          exam: string
          held_on?: string | null
          id?: string
          key_url?: string | null
          label: string
          pages?: number | null
          question_count?: number
          slug: string
          source_url: string
          status?: string
          year: number
        }
        Update: {
          answer_source?: string
          created_at?: string
          exam?: string
          held_on?: string | null
          id?: string
          key_url?: string | null
          label?: string
          pages?: number | null
          question_count?: number
          slug?: string
          source_url?: string
          status?: string
          year?: number
        }
        Relationships: []
      }
      exam_questions: {
        Row: {
          answer: string | null
          body: string
          chapter_slug: string | null
          concept: string | null
          concept_id: string | null
          created_at: string
          figure: Json | null
          grade: number | null
          has_figure: boolean
          id: string
          in_syllabus: boolean
          kind: string
          ncert_kind: string | null
          ncert_ref: string | null
          number: number
          old_unit: string | null
          options: Json
          page: number | null
          paper_id: string
          passage: string | null
          qno: string | null
          solution: Json | null
          solution_ok: boolean
          source_type: string | null
          subject: string
          topic: string | null
        }
        Insert: {
          answer?: string | null
          body: string
          chapter_slug?: string | null
          concept?: string | null
          concept_id?: string | null
          created_at?: string
          figure?: Json | null
          grade?: number | null
          has_figure?: boolean
          id?: string
          in_syllabus?: boolean
          kind?: string
          ncert_kind?: string | null
          ncert_ref?: string | null
          number: number
          old_unit?: string | null
          options?: Json
          page?: number | null
          paper_id: string
          passage?: string | null
          qno?: string | null
          solution?: Json | null
          solution_ok?: boolean
          source_type?: string | null
          subject: string
          topic?: string | null
        }
        Update: {
          answer?: string | null
          body?: string
          chapter_slug?: string | null
          concept?: string | null
          concept_id?: string | null
          created_at?: string
          figure?: Json | null
          grade?: number | null
          has_figure?: boolean
          id?: string
          in_syllabus?: boolean
          kind?: string
          ncert_kind?: string | null
          ncert_ref?: string | null
          number?: number
          old_unit?: string | null
          options?: Json
          page?: number | null
          paper_id?: string
          passage?: string | null
          qno?: string | null
          solution?: Json | null
          solution_ok?: boolean
          source_type?: string | null
          subject?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "exam_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_events: {
        Row: {
          created_at: string
          id: number
          ip_hash: string
          kind: string
        }
        Insert: {
          created_at?: string
          id?: never
          ip_hash: string
          kind: string
        }
        Update: {
          created_at?: string
          id?: never
          ip_hash?: string
          kind?: string
        }
        Relationships: []
      }
      gov_exam_papers: {
        Row: {
          category: string
          checksum: string | null
          created_at: string
          exam: string
          expected_questions: number | null
          id: string
          jurisdiction: string
          key_source: string
          key_url: string | null
          label: string
          section: string
          slug: string
          source_kind: string
          source_url: string
          stage: string
          status: string
          year: number
        }
        Insert: {
          category: string
          checksum?: string | null
          created_at?: string
          exam: string
          expected_questions?: number | null
          id?: string
          jurisdiction?: string
          key_source?: string
          key_url?: string | null
          label: string
          section: string
          slug: string
          source_kind: string
          source_url: string
          stage: string
          status?: string
          year: number
        }
        Update: {
          category?: string
          checksum?: string | null
          created_at?: string
          exam?: string
          expected_questions?: number | null
          id?: string
          jurisdiction?: string
          key_source?: string
          key_url?: string | null
          label?: string
          section?: string
          slug?: string
          source_kind?: string
          source_url?: string
          stage?: string
          status?: string
          year?: number
        }
        Relationships: []
      }
      gov_exam_questions: {
        Row: {
          answer: string | null
          body: string
          concept: string
          id: string
          kind: string
          number: number
          options: Json
          page: number
          paper_id: string
          reviewed: boolean
          section: string
          solution: Json | null
          solution_ok: boolean
          topic: string
        }
        Insert: {
          answer?: string | null
          body: string
          concept: string
          id?: string
          kind?: string
          number: number
          options?: Json
          page: number
          paper_id: string
          reviewed?: boolean
          section: string
          solution?: Json | null
          solution_ok?: boolean
          topic: string
        }
        Update: {
          answer?: string | null
          body?: string
          concept?: string
          id?: string
          kind?: string
          number?: number
          options?: Json
          page?: number
          paper_id?: string
          reviewed?: boolean
          section?: string
          solution?: Json | null
          solution_ok?: boolean
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "gov_exam_questions_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "gov_exam_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_exam_solutions: {
        Row: {
          answer: string
          content: Json
          created_at: string
          evidence_hash: string
          question_id: string
          reviewed: boolean
          verification: string
        }
        Insert: {
          answer: string
          content: Json
          created_at?: string
          evidence_hash: string
          question_id: string
          reviewed?: boolean
          verification: string
        }
        Update: {
          answer?: string
          content?: Json
          created_at?: string
          evidence_hash?: string
          question_id?: string
          reviewed?: boolean
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "gov_exam_solutions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "gov_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_exam_topics: {
        Row: {
          content: Json
          evidence_hash: string
          exam: string
          id: string
          jurisdiction: string
          reviewed: boolean
          section: string
          stage: string
          topic: string
        }
        Insert: {
          content: Json
          evidence_hash: string
          exam: string
          id?: string
          jurisdiction?: string
          reviewed?: boolean
          section: string
          stage: string
          topic: string
        }
        Update: {
          content?: Json
          evidence_hash?: string
          exam?: string
          id?: string
          jurisdiction?: string
          reviewed?: boolean
          section?: string
          stage?: string
          topic?: string
        }
        Relationships: []
      }
      ncert_sections: {
        Row: {
          chapter_slug: string
          grade: number
          heading: string
          id: string
          kind: string
          page: number
          pdf_url: string
          printed_page: number | null
          ref: string
          subject: string
        }
        Insert: {
          chapter_slug: string
          grade: number
          heading?: string
          id?: string
          kind: string
          page: number
          pdf_url: string
          printed_page?: number | null
          ref: string
          subject: string
        }
        Update: {
          chapter_slug?: string
          grade?: number
          heading?: string
          id?: string
          kind?: string
          page?: number
          pdf_url?: string
          printed_page?: number | null
          ref?: string
          subject?: string
        }
        Relationships: []
      }
      note_audio: {
        Row: {
          created_at: string
          id: string
          note_id: string
          storage_path: string
          track_index: number
          voice: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          storage_path: string
          track_index: number
          voice: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          storage_path?: string
          track_index?: number
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_audio_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_checks: {
        Row: {
          checked_at: string
          issues: Json
          note_id: string
        }
        Insert: {
          checked_at?: string
          issues?: Json
          note_id: string
        }
        Update: {
          checked_at?: string
          issues?: Json
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_checks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_reports: {
        Row: {
          applied_at: string | null
          board: string | null
          chapter_slug: string | null
          chapter_title: string | null
          correction: string | null
          created_at: string
          grade: number | null
          id: string
          language: string | null
          message: string
          note_id: string | null
          resolved_at: string | null
          section: string | null
          status: string
          subject: string | null
        }
        Insert: {
          applied_at?: string | null
          board?: string | null
          chapter_slug?: string | null
          chapter_title?: string | null
          correction?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          language?: string | null
          message: string
          note_id?: string | null
          resolved_at?: string | null
          section?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          applied_at?: string | null
          board?: string | null
          chapter_slug?: string | null
          chapter_title?: string | null
          correction?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          language?: string | null
          message?: string
          note_id?: string | null
          resolved_at?: string | null
          section?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_reports_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          board: string
          book_name: string | null
          chapter_slug: string
          chapter_title: string
          content: Json
          created_at: string
          grade: number
          id: string
          is_custom: boolean
          language: string
          subject: string
        }
        Insert: {
          board: string
          book_name?: string | null
          chapter_slug: string
          chapter_title: string
          content: Json
          created_at?: string
          grade: number
          id?: string
          is_custom?: boolean
          language: string
          subject: string
        }
        Update: {
          board?: string
          book_name?: string | null
          chapter_slug?: string
          chapter_title?: string
          content?: Json
          created_at?: string
          grade?: number
          id?: string
          is_custom?: boolean
          language?: string
          subject?: string
        }
        Relationships: []
      }
      syllabi: {
        Row: {
          board: string
          books: Json
          created_at: string
          grade: number
          id: string
          subject: string
        }
        Insert: {
          board: string
          books?: Json
          created_at?: string
          grade: number
          id?: string
          subject: string
        }
        Update: {
          board?: string
          books?: Json
          created_at?: string
          grade?: number
          id?: string
          subject?: string
        }
        Relationships: []
      }
      user_notebooks: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      exam_chapter_stats: {
        Row: {
          advanced_count: number | null
          chapter_slug: string | null
          exam_group: string | null
          grade: number | null
          main_count: number | null
          neet_count: number | null
          papers: number | null
          questions: number | null
          subject: string | null
          years: number[] | null
        }
        Relationships: []
      }
      exam_concept_stats: {
        Row: {
          chapter_slug: string | null
          concept: string | null
          concept_id: string | null
          exam_group: string | null
          grade: number | null
          questions: number | null
          subject: string | null
        }
        Relationships: []
      }
      exam_coverage: {
        Row: {
          answer_source: string | null
          exam: string | null
          exam_group: string | null
          held_on: string | null
          label: string | null
          question_count: number | null
          slug: string | null
          source_url: string | null
          year: number | null
        }
        Insert: {
          answer_source?: string | null
          exam?: string | null
          exam_group?: never
          held_on?: string | null
          label?: string | null
          question_count?: number | null
          slug?: string | null
          source_url?: string | null
          year?: number | null
        }
        Update: {
          answer_source?: string | null
          exam?: string | null
          exam_group?: never
          held_on?: string | null
          label?: string | null
          question_count?: number | null
          slug?: string | null
          source_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      exam_old_unit_stats: {
        Row: {
          advanced_count: number | null
          exam_group: string | null
          main_count: number | null
          neet_count: number | null
          old_unit: string | null
          questions: number | null
          subject: string | null
          years: number[] | null
        }
        Relationships: []
      }
      exam_subject_stats: {
        Row: {
          exam_group: string | null
          out_of_syllabus: number | null
          questions: number | null
          subject: string | null
          unmapped: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_book_passages: {
        Args: { b?: string; g?: number; n?: number; q: string }
        Returns: {
          board: string
          chapter_slug: string
          grade: number
          rank: number
          snippet: string
          source_url: string
          subject: string
        }[]
      }
      search_chapter_sources: {
        Args: { n?: number; q: string }
        Returns: {
          board: string
          chapter_slug: string
          grade: number
          rank: number
          snippet: string
          source_url: string
          subject: string
        }[]
      }
      search_chapters: {
        Args: { max_results?: number; q: string }
        Returns: {
          board: string
          book: string
          grade: number
          slug: string
          subject: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
