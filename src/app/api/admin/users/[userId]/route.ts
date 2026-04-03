import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireModerator, isAdmin } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'

type UpdatePayload = {
  role?: 'admin' | 'moderator' | 'user'
  is_disabled?: boolean
  is_banned?: boolean
  display_name?: string
  chips_balance?: number
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    // Allow admins + moderators; moderators cannot change roles.
    await requireModerator()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const actor = await requireModerator()
  const actorIsAdmin = isAdmin(actor)

  let payload: UpdatePayload
  try {
    payload = (await request.json()) as UpdatePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (payload.role !== undefined) {
    if (!actorIsAdmin) return NextResponse.json({ error: 'Role changes require admin' }, { status: 403 })
    if (payload.role === 'admin' || payload.role === 'moderator' || payload.role === 'user') update.role = payload.role
  }
  if (typeof payload.is_disabled === 'boolean') update.is_disabled = payload.is_disabled
  if (typeof payload.is_banned === 'boolean') update.is_banned = payload.is_banned
  if (typeof payload.display_name === 'string') {
    const v = payload.display_name.trim().slice(0, 40)
    if (v.length < 1) return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 })
    update.display_name = v
  }
  if (typeof payload.chips_balance === 'number') {
    if (!Number.isFinite(payload.chips_balance) || !Number.isInteger(payload.chips_balance) || payload.chips_balance < 0 || payload.chips_balance > 1_000_000_000) {
      return NextResponse.json({ error: 'Invalid chips_balance' }, { status: 400 })
    }
    update.chips_balance = payload.chips_balance
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('id,email,username,display_name,role,is_disabled,is_banned,chips_balance,created_at,updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Best-effort audit logging (do not fail the main update if logging fails).
  try {
    const actionType =
      update.chips_balance !== undefined
        ? 'chips_updated'
        : update.is_disabled !== undefined || update.is_banned !== undefined
          ? 'moderation_flags_updated'
          : update.role !== undefined
            ? 'role_updated'
            : 'user_profile_updated'

    await writeAdminAuditLog({
      actor,
      actionType,
      targetUserId: userId,
      payload: update as Record<string, unknown>,
    })
  } catch {
    // Ignore audit errors
  }

  return NextResponse.json({ user: data })
}

