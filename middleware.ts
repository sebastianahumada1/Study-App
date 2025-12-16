import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Note: Next.js 16 recommends "proxy" instead of "middleware", but we need to use
// "middleware" here because Supabase SSR requires Edge Runtime, which is only
// available with middleware, not proxy (proxy uses Node.js runtime).
// This warning can be safely ignored.
export async function middleware(request: NextRequest) {
  try {
    // Check if environment variables are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Middleware: Missing Supabase environment variables')
      return NextResponse.next({ request })
    }

    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session if expired - required for Server Components
    // Wrap in try-catch to prevent middleware from crashing
    try {
      await supabase.auth.getUser()
    } catch (authError) {
      // Log error but don't fail the request
      console.error('Middleware: Error refreshing auth session:', authError)
    }

    return supabaseResponse
  } catch (error) {
    // If anything fails in middleware, log it but continue with the request
    console.error('Middleware: Unexpected error:', error)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

