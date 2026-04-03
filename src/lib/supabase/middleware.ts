import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('[middleware]', request.nextUrl.pathname, user ? `user=${user.id}` : 'no-user')

  const protectedPaths = ['/profile', '/room', '/leaderboard']
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  const isProtected = isAdminPath || protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // If the user is signed in, enforce role/flags for protected routes.
  // This is server-side enforcement (not relying on frontend-only checks).
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,is_disabled,is_banned')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role
    const isDisabled = !!profile?.is_disabled
    const isBanned = !!profile?.is_banned

    if (isAdminPath) {
      if (role !== 'admin' && role !== 'moderator') {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } else if (isDisabled || isBanned) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      url.searchParams.set('error', isBanned ? 'account_banned' : 'account_disabled')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
