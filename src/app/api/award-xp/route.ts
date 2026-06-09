// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProgression } from '@/lib/gamification'

// ─── Barème XP (aligné sur GAMIFICATION_MEELLO.md) ───────────────────────────
// dailyCap : nombre max de fois que l'action crédite par jour (null = pas de cap journalier)
// once     : gain unique (une seule fois par membre, à vie)
const XP_CONFIG: Record<string, { base: number; dailyCap?: number; once?: boolean }> = {
  // Gains uniques
  profile_completed: { base: 150, once: true }, // Profil complété à 100%
  first_service:     { base: 50,  once: true }, // Première fiche produit / service

  // Feed / engagement (XP pour celui qui agit). "posts" = feed + communauté.
  comment_post: { base: 8, dailyCap: 3 },  // Commenter un post
  like_post:    { base: 2, dailyCap: 5 },  // Liker un post
  poll_vote:    { base: 2, dailyCap: 3 },  // Répondre à un sondage (voter)

  // Événements (on récompense, on ne surveille pas)
  event_joined:  { base: 15, dailyCap: 3 },  // Participer à un événement
  event_created: { base: 100, dailyCap: 2 }, // Organiser un événement

  // Connexions : géré séparément (dégressif) — voir plus bas. Pas de base fixe ici.
  connection_accepted: { base: 0 },

  // Tracking seul (0 XP) : sert au suivi des défis hebdo (ex : publier un post).
  post_created: { base: 0 },

  // Revenir (régularité)
  daily_login: { base: 5, dailyCap: 1 },     // Connexion du jour
  weekly_streak: { base: 50, dailyCap: 1 },  // Bonus série de semaine (déclenché par le cron)
}

// XP d'une connexion selon le nombre de connexions déjà acceptées (dégressif).
// 1re = +30, 2 à 10 = +10 chacune, au-delà de 10 = 0.
function connectionXP(previousAcceptedCount: number): number {
  if (previousAcceptedCount <= 0) return 30
  if (previousAcceptedCount < 10) return 10
  return 0
}

export async function POST(req: NextRequest) {
  try {
    const { userId, action } = await req.json()
    if (!userId || !action) {
      return NextResponse.json({ error: 'userId et action requis' }, { status: 400 })
    }

    const config = XP_CONFIG[action]
    if (!config) {
      return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 })
    }

    const supabase = createAdminClient()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    // Marquer le jour comme actif (base des séries hebdo / flamme). Idempotent.
    const todayStr = new Date().toISOString().slice(0, 10)
    await supabase
      .from('daily_activity')
      .upsert({ user_id: userId, day: todayStr }, { onConflict: 'user_id,day' })

    // ─── Gain unique : refuser si déjà obtenu une fois ────────────────────────
    if (config.once) {
      const { count: alreadyCount } = await supabase
        .from('xp_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', action)
      if ((alreadyCount ?? 0) > 0) {
        return NextResponse.json({ awarded: 0, reason: 'already_earned' })
      }
    }

    // ─── Plafond journalier ───────────────────────────────────────────────────
    if (config.dailyCap != null) {
      const { count: todayCount } = await supabase
        .from('xp_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', action)
        .gte('created_at', startOfDay.toISOString())
      if ((todayCount ?? 0) >= config.dailyCap) {
        return NextResponse.json({ awarded: 0, reason: 'cap_reached' })
      }
    }

    // ─── Calcul de l'XP gagné ─────────────────────────────────────────────────
    let xpEarned = config.base

    if (action === 'connection_accepted') {
      // Compter les connexions déjà créditées (via xp_logs) pour la dégressivité.
      const { count: prevCount } = await supabase
        .from('xp_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', 'connection_accepted')
      xpEarned = connectionXP(prevCount ?? 0)
      if (xpEarned === 0) {
        return NextResponse.json({ awarded: 0, reason: 'connection_cap' })
      }
    }

    // ─── Récupérer le total actuel ────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', userId)
      .single()
    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    // ─── Logguer + mettre à jour le total ─────────────────────────────────────
    await supabase.from('xp_logs').insert({
      user_id: userId,
      action,
      xp_earned: xpEarned,
    })

    const newTotalXP = (profile.xp ?? 0) + xpEarned
    await supabase.from('profiles').update({ xp: newTotalXP }).eq('id', userId)

    const prog = getProgression(newTotalXP)

    return NextResponse.json({
      awarded: xpEarned,
      totalXP: newTotalXP,
      level: prog.level,
      currentXP: prog.currentXP,
      xpToNext: prog.xpToNext,
      palier: prog.palier.name,
    })
  } catch (err) {
    console.error('[award-xp]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
