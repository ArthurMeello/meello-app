// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { titleCase } from '@/lib/format'

const EQUIPE_MEELLO_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ ok: false })

  const supabase = createAdminClient()

  // Vérifier si le welcome a déjà été envoyé
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, activity, city, country, welcome_sent')
    .eq('id', userId)
    .single()

  if (!profile || profile.welcome_sent) {
    return NextResponse.json({ ok: false, reason: 'already_sent' })
  }

  // Marquer comme envoyé immédiatement pour éviter les doublons
  await supabase.from('profiles').update({ welcome_sent: true }).eq('id', userId)

  // Publier le post de bienvenue
  const profileUrl = `https://app.meello.fr/membre/${userId}`
  const firstName = titleCase(profile.first_name)
  const cityLine = profile.city ? ` à ${titleCase(profile.city)}` : ''
  const fullName = `${titleCase(profile.first_name)} ${titleCase(profile.last_name)}`
  const welcomeContent = [
    `🎉 Nouvelle tête dans la communauté ! Bienvenue à @[${firstName}](${userId}) !`,
    ``,
    `${fullName} est ${profile.activity}${cityLine}.`,
    ``,
    `N'hésite pas à lui souhaiter la bienvenue 👋`,
    ``,
    `[→ Voir le profil de ${firstName}](${profileUrl})`,
  ].join('\n')

  const { data: post } = await supabase.from('posts').insert({
    author_id: EQUIPE_MEELLO_ID,
    content: welcomeContent,
  }).select('id').single()

  // Notifier le nouveau membre
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'mention',
    content: `vous a souhaité la bienvenue dans le fil d'actualité !`,
    link: post?.id ? `/feed?post=${post.id}` : `/feed`,
    from_user_id: EQUIPE_MEELLO_ID,
  })

  return NextResponse.json({ ok: true })
}
