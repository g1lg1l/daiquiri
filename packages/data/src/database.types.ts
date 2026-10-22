export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity: {
        Row: {
          actor_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          id: number;
          kind: string;
          project_id: string | null;
          task_id: string | null;
          team_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: never;
          kind: string;
          project_id?: string | null;
          task_id?: string | null;
          team_id?: string | null;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: never;
          kind?: string;
          project_id?: string | null;
          task_id?: string | null;
          team_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      comment_reactions: {
        Row: {
          comment_id: string;
          created_at: string;
          emoji: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment_id: string;
          created_at?: string;
          emoji: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          emoji?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comment_reactions_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comment_reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comment_reactions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string | null;
          body: NonNullable<Json>;
          body_text: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          parent_id: string | null;
          task_id: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: NonNullable<Json>;
          body_text?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          parent_id?: string | null;
          task_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: NonNullable<Json>;
          body_text?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          parent_id?: string | null;
          task_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          entity_id: string;
          entity_kind: string;
          sort_key: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          entity_id: string;
          entity_kind: string;
          sort_key?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          entity_kind?: string;
          sort_key?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          revoked_at: string | null;
          role: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          token_hash?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      labels: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'labels_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          archived_at: string | null;
          comment_id: string | null;
          created_at: string;
          event_count: number;
          id: string;
          kind: string;
          read_at: string | null;
          snoozed_until: string | null;
          task_id: string | null;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          archived_at?: string | null;
          comment_id?: string | null;
          created_at?: string;
          event_count?: number;
          id?: string;
          kind: string;
          read_at?: string | null;
          snoozed_until?: string | null;
          task_id?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          archived_at?: string | null;
          comment_id?: string | null;
          created_at?: string;
          event_count?: number;
          id?: string;
          kind?: string;
          read_at?: string | null;
          snoozed_until?: string | null;
          task_id?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          description: Json | null;
          id: string;
          lead_id: string | null;
          name: string;
          sort_key: string;
          start_date: string | null;
          status: Database['public']['Enums']['project_status'];
          target_date: string | null;
          team_id: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: Json | null;
          id?: string;
          lead_id?: string | null;
          name: string;
          sort_key?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['project_status'];
          target_date?: string | null;
          team_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: Json | null;
          id?: string;
          lead_id?: string | null;
          name?: string;
          sort_key?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['project_status'];
          target_date?: string | null;
          team_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_workspace_id_lead_id_fkey';
            columns: ['workspace_id', 'lead_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
          {
            foreignKeyName: 'projects_workspace_id_team_id_fkey';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      statuses: {
        Row: {
          category: Database['public']['Enums']['status_category'];
          created_at: string;
          id: string;
          name: string;
          position: number;
          team_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: Database['public']['Enums']['status_category'];
          created_at?: string;
          id?: string;
          name: string;
          position?: number;
          team_id: string;
          workspace_id: string;
        };
        Update: {
          category?: Database['public']['Enums']['status_category'];
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          team_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'statuses_workspace_id_team_id_fkey';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_assignees: {
        Row: {
          created_at: string;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          task_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_assignees_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_assignees_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      task_labels: {
        Row: {
          created_at: string;
          label_id: string;
          task_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          label_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          label_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_labels_workspace_id_label_id_fkey';
            columns: ['workspace_id', 'label_id'];
            isOneToOne: false;
            referencedRelation: 'labels';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_labels_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_relations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database['public']['Enums']['relation_kind'];
          related_task_id: string;
          task_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database['public']['Enums']['relation_kind'];
          related_task_id: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['relation_kind'];
          related_task_id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_relations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_relations_workspace_id_related_task_id_fkey';
            columns: ['workspace_id', 'related_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_relations_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      task_subscribers: {
        Row: {
          created_at: string;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          task_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          task_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_subscribers_workspace_id_task_id_fkey';
            columns: ['workspace_id', 'task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'task_subscribers_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      tasks: {
        Row: {
          canceled_at: string | null;
          completed_at: string | null;
          created_at: string;
          creator_id: string | null;
          deleted_at: string | null;
          description: Json | null;
          description_text: string;
          due_date: string | null;
          estimate: number | null;
          id: string;
          number: number;
          parent_id: string | null;
          priority: number;
          project_id: string | null;
          search: unknown;
          sort_key: string;
          start_date: string | null;
          status_id: string;
          team_id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          canceled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          creator_id?: string | null;
          deleted_at?: string | null;
          description?: Json | null;
          description_text?: string;
          due_date?: string | null;
          estimate?: number | null;
          id?: string;
          number: number;
          parent_id?: string | null;
          priority?: number;
          project_id?: string | null;
          search?: never;
          sort_key: string;
          start_date?: string | null;
          status_id: string;
          team_id: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          canceled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          creator_id?: string | null;
          deleted_at?: string | null;
          description?: Json | null;
          description_text?: string;
          due_date?: string | null;
          estimate?: number | null;
          id?: string;
          number?: number;
          parent_id?: string | null;
          priority?: number;
          project_id?: string | null;
          search?: never;
          sort_key?: string;
          start_date?: string | null;
          status_id?: string;
          team_id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_team_id_parent_id_fkey';
            columns: ['team_id', 'parent_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['team_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_team_id_project_id_fkey';
            columns: ['team_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['team_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_team_id_status_id_fkey';
            columns: ['team_id', 'status_id'];
            isOneToOne: false;
            referencedRelation: 'statuses';
            referencedColumns: ['team_id', 'id'];
          },
          {
            foreignKeyName: 'tasks_workspace_id_team_id_fkey';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      team_members: {
        Row: {
          created_at: string;
          team_id: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          team_id: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          team_id?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_workspace_id_team_id_fkey';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'team_members_workspace_id_user_id_fkey';
            columns: ['workspace_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_members';
            referencedColumns: ['workspace_id', 'user_id'];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          cycles_enabled: boolean;
          description: string | null;
          estimates_enabled: boolean;
          id: string;
          is_private: boolean;
          key: string;
          name: string;
          task_seq: number;
          triage_enabled: boolean;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          cycles_enabled?: boolean;
          description?: string | null;
          estimates_enabled?: boolean;
          id?: string;
          is_private?: boolean;
          key: string;
          name: string;
          task_seq?: number;
          triage_enabled?: boolean;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          cycles_enabled?: boolean;
          description?: string | null;
          estimates_enabled?: boolean;
          id?: string;
          is_private?: boolean;
          key?: string;
          name?: string;
          task_seq?: number;
          triage_enabled?: boolean;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      views: {
        Row: {
          config: NonNullable<Json>;
          created_at: string;
          id: string;
          is_shared: boolean;
          name: string;
          owner_id: string | null;
          team_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          config?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          is_shared?: boolean;
          name: string;
          owner_id?: string | null;
          team_id?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          config?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          is_shared?: boolean;
          name?: string;
          owner_id?: string | null;
          team_id?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'views_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'views_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'views_workspace_id_team_id_fkey';
            columns: ['workspace_id', 'team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: { token: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_demo_workspace: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_invitation: {
        Args: {
          email: string;
          role?: Database['public']['Enums']['workspace_role'];
          workspace_id: string;
        };
        Returns: string;
      };
      create_task: {
        Args: {
          assignee_ids?: string[];
          description?: Json;
          due_date?: string;
          id: string;
          label_ids?: string[];
          parent_id?: string;
          priority?: number;
          project_id?: string;
          sort_key?: string;
          start_date?: string;
          status_id?: string;
          team_id: string;
          title: string;
        };
        Returns: {
          canceled_at: string | null;
          completed_at: string | null;
          created_at: string;
          creator_id: string | null;
          deleted_at: string | null;
          description: Json | null;
          description_text: string;
          due_date: string | null;
          estimate: number | null;
          id: string;
          number: number;
          parent_id: string | null;
          priority: number;
          project_id: string | null;
          search: unknown;
          sort_key: string;
          start_date: string | null;
          status_id: string;
          team_id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'tasks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_team: {
        Args: {
          is_private?: boolean;
          key: string;
          name: string;
          template?: string;
          workspace_id: string;
        };
        Returns: {
          created_at: string;
          cycles_enabled: boolean;
          description: string | null;
          estimates_enabled: boolean;
          id: string;
          is_private: boolean;
          key: string;
          name: string;
          task_seq: number;
          triage_enabled: boolean;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'teams';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_workspace: {
        Args: {
          name: string;
          slug: string;
          team_key?: string;
          team_name?: string;
          template?: string;
        };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_tasks: { Args: { task_ids: string[] }; Returns: string };
      preview_invitation: {
        Args: { token: string };
        Returns: {
          email: string;
          role: Database['public']['Enums']['workspace_role'];
          workspace_name: string;
        }[];
      };
      remove_member: { Args: { user_id: string; workspace_id: string }; Returns: undefined };
      restore_tasks: { Args: { task_ids: string[] }; Returns: number };
      revoke_invitation: { Args: { invitation_id: string }; Returns: undefined };
      search: {
        Args: { max_results?: number; query: string; workspace_id: string };
        Returns: {
          id: string;
          kind: string;
          rank: number;
          subtitle: string;
          title: string;
        }[];
      };
      set_member_role: {
        Args: {
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        Returns: undefined;
      };
      set_task_assignees: { Args: { task_id: string; user_ids: string[] }; Returns: undefined };
      set_task_labels: { Args: { label_ids: string[]; task_id: string }; Returns: undefined };
      workspace_member_emails: {
        Args: { workspace_id: string };
        Returns: {
          email: string;
          user_id: string;
        }[];
      };
    };
    Enums: {
      project_status: 'planned' | 'active' | 'paused' | 'completed' | 'canceled';
      relation_kind: 'blocks' | 'related' | 'duplicate';
      status_category: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
      workspace_role: 'owner' | 'admin' | 'member' | 'guest';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      project_status: ['planned', 'active', 'paused', 'completed', 'canceled'],
      relation_kind: ['blocks', 'related', 'duplicate'],
      status_category: ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'],
      workspace_role: ['owner', 'admin', 'member', 'guest'],
    },
  },
} as const;
