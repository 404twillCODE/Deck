import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireModerator } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    await requireModerator()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const actionType = (url.searchParams.get('actionType') || '').trim().slice(0, 80)
  const targetUserId = (url.searchParams.get('targetUserId') || '').trim().slice(0, 64)
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Math.max(1, Math.min(200, Number.parseInt(limitRaw, 10))) : 50

  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('admin_audit_log')
    .select('id,actor_id,actor_role,action_type,target_user_id,payload,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (actionType) query = query.eq('action_type', actionType)
  if (targetUserId) query = query.eq('target_user_id', targetUserId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: data || [] })
}

