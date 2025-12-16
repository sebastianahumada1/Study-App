import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get user email and metadata
  const userEmail = user.email || 'No email'
  const userMetadata = user.user_metadata || {}

  return (
    <ProfileClient
      userId={user.id}
      email={userEmail}
      metadata={userMetadata}
    />
  )
}

