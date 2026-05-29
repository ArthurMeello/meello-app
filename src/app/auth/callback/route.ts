// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const code = url.searchParams.get('code')

  const redirectBase = 'https://app.meello.fr/bienvenue'

  // Cas 1 : PKCE flow (code)
  if (code) {
    return NextResponse.redirect(`${redirectBase}?code=${code}`)
  }

  // Cas 2 : token_hash (invite / recovery via email)
  if (token_hash && type) {
    return NextResponse.redirect(`${redirectBase}?token_hash=${token_hash}&type=${type}`)
  }

  // Fallback
  return NextResponse.redirect('https://app.meello.fr/connexion?error=lien_invalide')
}
