// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mondayOf, CHALLENGE_DEFS } from '@/lib/gamification'

// GET ?userId=...  → renvoie les 3 défis de la semaine du membre.
// - Assigne les défis si pas encore fait pour la semaine (auto-réparant).
// - Recalcule la progression depuis xp_logs (source de vérité).
// - Crédite le boost quand un défi atteint sa cible (une seule fois).

// Choisit 3 défis personnalisés selon le profil du membre.
function pickChallenges(profile: any, completion: number, connectionCount: number): string[] {
  const picks: string[] = []
  // Profil incomplet → compléter le profil
  if (completion < 100) picks.push('complete_profil')
  // Peu connecté → pousser le réseau
  if (connectionCount < 10) {
    picks.push('brise_la_glace')
    if (picks.length < 3) picks.push('fais_connaissance')
  }
  // Compléter avec des défis d'interaction (toujours faisables)
  for (const id of ['donne_ton_avis', 'partage_ton_actu', 'fais_connaissance', 'brise_la_glace']) {
    if (picks.length >= 3) break
    if (!picks.includes(id)) picks.push(id)
  }
  return picks.slice(0, 3)
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const supabase = createAdminClient()
  const weekStart = mondayOf(new Date())

  // 1) Défis déjà assignés cette semaine ?
  let { data: assigned } = await supabase
    .from('weekly_challenges')
    .select('challenge_id, completed')
    .eq('user_id', userId)
    .eq('week_start', weekStart)

  // 2) Sinon, assigner 3 défis personnalisés.
  if (!assigned || assigned.length === 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Complétion approximative : profil considéré complet si avatar + bio + activité + ville renseignés.
    const completion =
      (profile?.avatar_url ? 25 : 0) +
      (profile?.bio ? 25 : 0) +
      (profile?.activity ? 25 : 0) +
      (profile?.city ? 25 : 0)

    const { count: connectionCount } = await supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted')

    const picks = pickChallenges(profile, completion, connectionCount ?? 0)
    const rows = picks.map(cid => ({ user_id: userId, challenge_id: cid, week_start: weekStart }))
    await supabase.from('weekly_challenges').upsert(rows, { onConflict: 'user_id,challenge_id,week_start' })

    const res = await supabase
      .from('weekly_challenges')
      .select('challenge_id, completed')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
    assigned = res.data
  }

  // 3) Détails des défis (banque) + progression depuis xp_logs.
  const ids = (assigned || []).map(a => a.challenge_id)
  const { data: bank } = await supabase
    .from('challenges')
    .select('*')
    .in('id', ids.length ? ids : ['__none__'])
  const bankMap = Object.fromEntries((bank || []).map(c => [c.id, c]))

  const weekStartIso = new Date(weekStart + 'T00:00:00Z').toISOString()

  const result = []
  for (const a of assigned || []) {
    const def = CHALLENGE_DEFS[a.challenge_id]
    const info = bankMap[a.challenge_id]
    if (!def || !info) continue

    // Progression = nb de lignes xp_logs de l'action depuis le début de la semaine.
    const { count } = await supabase
      .from('xp_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', def.countAction)
      .gte('created_at', weekStartIso)
    const progress = Math.min(count ?? 0, def.target)
    const justCompleted = progress >= def.target && !a.completed

    // Crédit du boost à la complétion (une seule fois).
    if (justCompleted) {
      await supabase
        .from('weekly_challenges')
        .update({ completed: true, completed_at: new Date().toISOString(), progress })
        .eq('user_id', userId)
        .eq('challenge_id', a.challenge_id)
        .eq('week_start', weekStart)
      await supabase.from('xp_logs').insert({ user_id: userId, action: `challenge_${a.challenge_id}`, xp_earned: def.boost })
      const { data: p } = await supabase.from('profiles').select('xp').eq('id', userId).single()
      await supabase.from('profiles').update({ xp: (p?.xp ?? 0) + def.boost }).eq('id', userId)
    }

    result.push({
      id: a.challenge_id,
      label: info.label,
      description: info.description,
      boost: info.boost_xp,
      target: def.target,
      progress,
      completed: a.completed || justCompleted,
    })
  }

  return NextResponse.json({ weekStart, challenges: result })
}
