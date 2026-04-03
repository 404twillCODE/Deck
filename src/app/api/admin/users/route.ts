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
  const searchRaw = url.searchParams.get('search') || ''
  const search = searchRaw.trim().slice(0, 60).replace(/[%_]/g, '')

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('profiles')
    .select('id,email,username,display_name,role,is_disabled,is_banned,chips_balance,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) {
    query = query.or(
      `email.ilike.%${search}%,username.ilike.%${search}%,display_name.ilike.%${search}%`,
    )
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data || [] })
}

