// Supabase schema types for moshimoshi — same shape as `supabase gen types typescript`.
// Mirrors supabase/migrations/20261025000001_init.sql + 20261025000002_admin.sql and the later files (hand-edited
// through 20261117000001_lifestage_intro_watch.sql); regenerate after schema changes.
// Usage: createClient<Database>(url, key) · Tables<'profiles'> · TablesInsert<'intents'>

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  __InternalSupabase: {
    PostgrestVersion: '13.0.5'
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked: string
          blocker: string
          created_at: string
        }
        Insert: {
          blocked: string
          blocker: string
          created_at?: string
        }
        Update: {
          blocked?: string
          blocker?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_fkey'
            columns: ['blocked']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'blocks_blocker_fkey'
            columns: ['blocker']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          consent_media: boolean
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          consent_media?: boolean
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          consent_media?: boolean
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_members_chat_id_fkey'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      chat_message_sames: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_message_sames_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'chat_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_message_sames_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'chat_messages_chat_id_fkey'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      chats: {
        Row: {
          closed_at: string | null
          created_at: string
          icebreaker: string | null
          id: string
          kind: string
          pair_question: string | null
          requested_by: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          icebreaker?: string | null
          id?: string
          kind?: string
          pair_question?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          icebreaker?: string | null
          id?: string
          kind?: string
          pair_question?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chats_requested_by_fkey'
            columns: ['requested_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      chat_pair_answers: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_pair_answers_chat_id_fkey'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_pair_answers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      intro_requests: {
        Row: {
          chat_id: string | null
          created_at: string
          expires_at: string
          from_user: string
          id: string
          responded_at: string | null
          status: string
          to_user: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          expires_at?: string
          from_user: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          expires_at?: string
          from_user?: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: 'intro_requests_chat_id_fkey'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'intro_requests_from_user_fkey'
            columns: ['from_user']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'intro_requests_to_user_fkey'
            columns: ['to_user']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      room_watch: {
        Row: {
          anyone_can_control: boolean
          duration_s: number | null
          is_live: boolean
          playing: boolean
          position_at: string
          position_s: number
          provider: string | null
          rate: number
          ref: string | null
          room_id: string
          started_at: string | null
          started_by: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          anyone_can_control?: boolean
          duration_s?: number | null
          is_live?: boolean
          playing?: boolean
          position_at?: string
          position_s?: number
          provider?: string | null
          rate?: number
          ref?: string | null
          room_id: string
          started_at?: string | null
          started_by?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          anyone_can_control?: boolean
          duration_s?: number | null
          is_live?: boolean
          playing?: boolean
          position_at?: string
          position_s?: number
          provider?: string | null
          rate?: number
          ref?: string | null
          room_id?: string
          started_at?: string | null
          started_by?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'room_watch_room_id_fkey'
            columns: ['room_id']
            isOneToOne: true
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      watch_viewers: {
        Row: {
          id: string
          room_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          room_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          room_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'watch_viewers_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'watch_viewers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      daily_answer_sames: {
        Row: {
          answer_user_id: string
          created_at: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer_user_id: string
          created_at?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer_user_id?: string
          created_at?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_answer_sames_question_id_answer_user_id_fkey'
            columns: ['question_id', 'answer_user_id']
            isOneToOne: false
            referencedRelation: 'daily_answers'
            referencedColumns: ['question_id', 'user_id']
          },
          {
            foreignKeyName: 'daily_answer_sames_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      daily_answers: {
        Row: {
          body: string
          created_at: string
          question_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          question_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'daily_questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'daily_answers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      daily_questions: {
        Row: {
          body: string
          created_at: string
          day: string
          id: string
          room_id: string
        }
        Insert: {
          body: string
          created_at?: string
          day?: string
          id?: string
          room_id: string
        }
        Update: {
          body?: string
          created_at?: string
          day?: string
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_questions_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'room_stats'
            referencedColumns: ['room_id']
          },
          {
            foreignKeyName: 'daily_questions_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      event_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      intent_joins: {
        Row: {
          created_at: string
          intent_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          intent_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          intent_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'intent_joins_intent_id_fkey'
            columns: ['intent_id']
            isOneToOne: false
            referencedRelation: 'intents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'intent_joins_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      intents: {
        Row: {
          body: string
          created_at: string
          expires_at: string | null
          give: string | null
          id: string
          mode: string
          province: string | null
          role: string
          room_id: string | null
          slots: number | null
          status: string
          tag_id: string
          template: string
          user_id: string
          want: string | null
          when_kind: string
          when_label: string | null
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string | null
          give?: string | null
          id?: string
          mode: string
          province?: string | null
          role: string
          room_id?: string | null
          slots?: number | null
          status?: string
          tag_id: string
          template: string
          user_id: string
          want?: string | null
          when_kind: string
          when_label?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string | null
          give?: string | null
          id?: string
          mode?: string
          province?: string | null
          role?: string
          room_id?: string | null
          slots?: number | null
          status?: string
          tag_id?: string
          template?: string
          user_id?: string
          want?: string | null
          when_kind?: string
          when_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'intents_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'room_stats'
            referencedColumns: ['room_id']
          },
          {
            foreignKeyName: 'intents_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'intents_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          accessory: string | null
          bio: string
          birth_year: number | null
          chat_style: string[]
          color: string
          created_at: string
          face: string | null
          id: string
          is_host: boolean
          languages: string[]
          last_seen_at: string
          life_stages: string[]
          loves: string[]
          moshi_policy: string
          name: string
          onboarded: boolean
          online: string[]
          prompts: Json
          province: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          accessory?: string | null
          bio?: string
          birth_year?: number | null
          chat_style?: string[]
          color?: string
          created_at?: string
          face?: string | null
          id: string
          is_host?: boolean
          languages?: string[]
          last_seen_at?: string
          life_stages?: string[]
          loves?: string[]
          moshi_policy?: string
          name?: string
          onboarded?: boolean
          online?: string[]
          prompts?: Json
          province?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          accessory?: string | null
          bio?: string
          birth_year?: number | null
          chat_style?: string[]
          color?: string
          created_at?: string
          face?: string | null
          id?: string
          is_host?: boolean
          languages?: string[]
          last_seen_at?: string
          life_stages?: string[]
          loves?: string[]
          moshi_policy?: string
          name?: string
          onboarded?: boolean
          online?: string[]
          prompts?: Json
          province?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      prompt_sames: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          prompt_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          prompt_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          prompt_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'prompt_sames_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prompt_sames_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      reports: {
        Row: {
          chat_message_id: string | null
          created_at: string
          details: string | null
          id: string
          message_body: string | null
          message_context: string | null
          reason: string
          reporter: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          room_message_id: string | null
          status: string
          target_user: string | null
        }
        Insert: {
          chat_message_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_body?: string | null
          message_context?: string | null
          reason: string
          reporter?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_message_id?: string | null
          status?: string
          target_user?: string | null
        }
        Update: {
          chat_message_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_body?: string | null
          message_context?: string | null
          reason?: string
          reporter?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_message_id?: string | null
          status?: string
          target_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reports_chat_message_id_fkey'
            columns: ['chat_message_id']
            isOneToOne: false
            referencedRelation: 'chat_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_reporter_fkey'
            columns: ['reporter']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_room_message_id_fkey'
            columns: ['room_message_id']
            isOneToOne: false
            referencedRelation: 'room_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_target_user_fkey'
            columns: ['target_user']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      room_members: {
        Row: {
          joined_at: string
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'room_members_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'room_stats'
            referencedColumns: ['room_id']
          },
          {
            foreignKeyName: 'room_members_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      room_message_sames: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'room_message_sames_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'room_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_message_sames_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      room_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          room_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          room_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          room_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'room_messages_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'room_stats'
            referencedColumns: ['room_id']
          },
          {
            foreignKeyName: 'room_messages_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      rooms: {
        Row: {
          color: string
          icon: string
          id: string
          is_lobby: boolean
          name: string
          prime_time: string
          sort: number
          tagline: string
          tags: string[]
          vibe: string
        }
        Insert: {
          color?: string
          icon?: string
          id: string
          is_lobby?: boolean
          name: string
          prime_time?: string
          sort?: number
          tagline?: string
          tags?: string[]
          vibe?: string
        }
        Update: {
          color?: string
          icon?: string
          id?: string
          is_lobby?: boolean
          name?: string
          prime_time?: string
          sort?: number
          tagline?: string
          tags?: string[]
          vibe?: string
        }
        Relationships: []
      }
      session_rsvps: {
        Row: {
          created_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_rsvps_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_rsvps_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sessions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_min: number
          host_id: string | null
          host_name: string | null
          id: string
          plan_id: number | null
          room_id: string
          starts_at: string
          title: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_min?: number
          host_id?: string | null
          host_name?: string | null
          id?: string
          plan_id?: number | null
          room_id: string
          starts_at: string
          title: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_min?: number
          host_id?: string | null
          host_name?: string | null
          id?: string
          plan_id?: number | null
          room_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_host_id_fkey'
            columns: ['host_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'room_stats'
            referencedColumns: ['room_id']
          },
          {
            foreignKeyName: 'sessions_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
        ]
      }
      wave_answers: {
        Row: {
          answered_at: string
          choice: number
          question_id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          choice: number
          question_id: string
          user_id: string
        }
        Update: {
          answered_at?: string
          choice?: number
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wave_answers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      room_stats: {
        Row: {
          members: number | null
          online: number | null
          room_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_room_message: {
        Args: { p_message: string }
        Returns: undefined
      }
      admin_remove_chat_image: {
        Args: { p_message: string }
        Returns: string
      }
      admin_list_reports: {
        Args: { p_limit?: number; p_status?: string }
        Returns: {
          chat_message_id: string | null
          created_at: string
          details: string | null
          id: string
          message_body: string | null
          message_context: string | null
          message_removed: boolean
          prior_reports: number
          reason: string
          reporter: string | null
          reporter_name: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolver_name: string | null
          room_id: string | null
          room_message_id: string | null
          status: string
          target_color: string | null
          target_name: string | null
          target_suspended_until: string | null
          target_user: string | null
        }[]
      }
      admin_resolve_report: {
        Args: { p_note?: string; p_report: string; p_status: string }
        Returns: undefined
      }
      admin_stats: {
        Args: never
        Returns: {
          active_24h: number
          messages_24h: number
          open_reports: number
          users: number
        }[]
      }
      admin_suspend_user: {
        Args: { p_days: number; p_reason?: string; p_user: string }
        Returns: string | null
      }
      cancel_event: {
        Args: { p_session: string; p_stop_repeat?: boolean }
        Returns: undefined
      }
      create_event: {
        Args: {
          p_description: string | null
          p_duration_min: number
          p_repeat_weekly?: boolean
          p_room: string
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      is_admin: {
        Args: never
        Returns: boolean
      }
      mark_chat_read: {
        Args: { p_chat: string }
        Returns: undefined
      }
      my_blocked_people: {
        Args: never
        Returns: {
          accessory: string | null
          blocked_at: string
          color: string
          face: string | null
          name: string
          user_id: string
        }[]
      }
      my_suspended_until: {
        Args: never
        Returns: string | null
      }
      request_intro: {
        Args: { p_question?: string | null; p_target: string }
        Returns: string
      }
      respond_intro: {
        Args: { p_accept: boolean; p_intro: string; p_question?: string | null }
        Returns: string | null
      }
      respond_moshi: {
        Args: { accept: boolean; p_chat: string }
        Returns: undefined
      }
      close_chat: {
        Args: { p_chat: string }
        Returns: string
      }
      send_moshi: {
        Args: { opener: string; target: string }
        Returns: string
      }
      server_now: {
        Args: never
        Returns: string
      }
      stop_repeat: {
        Args: { p_session: string }
        Returns: undefined
      }
      watch_control: {
        Args: { p_action: string; p_position_s?: number | null; p_rate?: number | null; p_room: string }
        Returns: {
          anyone_can_control: boolean
          duration_s: number | null
          is_live: boolean
          playing: boolean
          position_at: string
          position_s: number
          provider: string | null
          rate: number
          ref: string | null
          room_id: string
          started_at: string | null
          started_by: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
      }
      watch_heartbeat: {
        Args: { p_room: string }
        Returns: boolean
      }
      watch_leave: {
        Args: { p_room: string }
        Returns: undefined
      }
      watch_report: {
        Args: { p_duration_s?: number | null; p_is_live?: boolean; p_ref: string; p_room: string }
        Returns: {
          anyone_can_control: boolean
          duration_s: number | null
          is_live: boolean
          playing: boolean
          position_at: string
          position_s: number
          provider: string | null
          rate: number
          ref: string | null
          room_id: string
          started_at: string | null
          started_by: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
      }
      watch_set_open: {
        Args: { p_open: boolean; p_room: string }
        Returns: {
          anyone_can_control: boolean
          duration_s: number | null
          is_live: boolean
          playing: boolean
          position_at: string
          position_s: number
          provider: string | null
          rate: number
          ref: string | null
          room_id: string
          started_at: string | null
          started_by: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
      }
      watch_start: {
        Args: {
          p_duration_s?: number | null
          p_is_live?: boolean
          p_position_s?: number
          p_provider: string
          p_ref: string
          p_room: string
          p_title?: string | null
        }
        Returns: {
          anyone_can_control: boolean
          duration_s: number | null
          is_live: boolean
          playing: boolean
          position_at: string
          position_s: number
          provider: string | null
          rate: number
          ref: string | null
          room_id: string
          started_at: string | null
          started_by: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
      }
      watch_stop: {
        Args: { p_room: string }
        Returns: {
          anyone_can_control: boolean
          duration_s: number | null
          is_live: boolean
          playing: boolean
          position_at: string
          position_s: number
          provider: string | null
          rate: number
          ref: string | null
          room_id: string
          started_at: string | null
          started_by: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
      }
      wave_card_preview: {
        Args: { p_user: string }
        Returns: {
          accessory: string | null
          color: string
          face: string | null
          name: string
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

type PublicSchema = Database['public']
type TablesAndViews = PublicSchema['Tables'] & PublicSchema['Views']

export type Tables<T extends keyof TablesAndViews> = TablesAndViews[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

export type CompositeTypes<T extends keyof PublicSchema['CompositeTypes']> = PublicSchema['CompositeTypes'][T]

export type DbFunctionArgs<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Args']

export type DbFunctionReturns<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns']

export const Constants = {
  public: {
    Enums: {},
  },
} as const
