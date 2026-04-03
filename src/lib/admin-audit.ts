import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'

type AuditActionType =
  | 'user_profile_updated'
  | 'role_updated'
  | 'chips_updated'
  | 'moderation_flags_updated'
  | 'admin_custom'

export async function writeAdminAuditLog(args: {
  actor: UserProfile
  actionType: AuditActionType | string
  targetUserId?: string
  payload?: Record<string, unknown>
}) {
  const supabase = await createServerSupabaseClient()

  // RLS on `admin_audit_log` should restrict who can read/write this table.
  await supabase.from('admin_audit_log').insert({
    actor_id: args.actor.id,
    actor_role: args.actor.role ?? 'user',
    action_type: args.actionType,
    target_user_id: args.targetUserId ?? null,
    payload: args.payload ?? {},
  })
}

