// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Définition des actions et leurs XP de base ───────────────────────────────
const XP_CONFIG: Record<string, { base: number; dailyCap: number }> = {
  // Forum
  forum_topic:        { base: 20, dailyCap: 3 },   // Créer un sujet
  forum_reply:        { base: 10, dailyCap: 5 },   // Répondre dans un sujet
  forum_like_given:  { base: 2,  dailyCap: 10 },  // Liker une réponse

  // Réseau
  connection_accepted: { base: 15, dailyCap: 5 },  // Connexion acceptée
  message_sent:        { base: 3,  dailyCap: 10 }, // Envoyer un message

  // Événements
  event_joined:    { base: 25, dailyCap: 2 },  // Rejoindre un événement
  event_created:   { base: 40, dailyCap: 1 },  // Créer un événement

  // Profil
  profile_completed: { base: 50, dailyCap: 1 }, // Atteindre 100% de complétion (une fois)
  profile_updated:   { base: 5,  dailyCap: 1 }, // Mettre à jour son profil

  // Recommendations
  reco_given:      { base: 20, dailyCap: 3 },  // Donner une recommandation
  reco_received:   { base: 10, dailyCap: 3 },  // Recevoir une recommandation
}

// ─── Calcul du niveau depuis les XP totaux ────────────────────────────────────
// Courbe exponentielle douce : level n requiert floor(50 * 1.18^(n-1)) XP
// Level 1 = 0 XP, Level 2 = 50 XP, Level 50 ≈ 28 000 XP total
export function getLevelFromXP(totalXP: number): { level: number; currentXP: number; xpToNext: number } {
  let level = 1
  let accumulated = 0

  while (level < 50) {
    const xpForNext = Math.floor(50 * Math.pow(1.18, level - 1))
    if (accumulated + xpForNext > totalXP) {
      return {
        level,
        currentXP: totalXP - accumulated,
        xpToNext: xpForNext,
      }
    }
    accumulated += xpForNext
    level++
  }

  // Niveau max (50)
  return { level: 50, currentXP: 0, xpToNext: 0 }
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

    // ─── Vérifier le cap journalier ───────────────────────────────────────────
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayCount } = await supabase
      .from('xp_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', today.toISOString())

    if ((todayCount ?? 0) >= config.dailyCap) {
      return NextResponse.json({
        awarded: 0,
        reason: 'cap_reached',
        message: `Cap journalier atteint pour l'action ${action}`,
      })
    }

    // ─── Vérifier le boost de démarrage (30 premiers jours) ──────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, member_since')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const memberSince = new Date(profile.member_since || Date.now())
    const daysSinceJoin = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24))
    const boostActive = daysSinceJoin <= 30
    const xpEarned = boostActive ? config.base * 2 : config.base

    // ─── Ajouter le log ───────────────────────────────────────────────────────
    await supabase.from('xp_logs').insert({
      user_id: userId,
      action,
      xp_earned: xpEarned,
    })

    // ─── Mettre à jour les XP du profil ───────────────────────────────────────
    const newTotalXP = (profile.xp ?? 0) + xpEarned
    await supabase
      .from('profiles')
      .update({ xp: newTotalXP })
      .eq('id', userId)

    const levelInfo = getLevelFromXP(newTotalXP)

    return NextResponse.json({
      awarded: xpEarned,
      totalXP: newTotalXP,
      boost: boostActive,
      level: levelInfo.level,
      currentXP: levelInfo.currentXP,
      xpToNext: levelInfo.xpToNext,
    })
  } catch (err) {
    console.error('[award-xp]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
