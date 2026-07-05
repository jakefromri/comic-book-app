import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL as string
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

/** Validates a Bearer token. Returns the user id, or null if invalid/missing. */
export async function requireUser(authHeader: string | null | undefined): Promise<string | null> {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
