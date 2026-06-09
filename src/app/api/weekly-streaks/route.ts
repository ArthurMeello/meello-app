// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mondayOf, countWeekdayActivity, ACTIVE_DAYS_REQUIRED } from '@/lib/gamification'

// Cron hebdomadaire (lundi) : valide la semaine écoulée pour chaque membre,
// met à jour la série consécutive (flamme) avec règle de grâce, crédite le
// bonus de série (+50 XP) aux membres dont la semaine est validée.
// Protégé par CRON_SECRET.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Semaine à valider = la semaine PRÉCÉDENTE (lundi dernier - 7 jours).
  const now = new Date()
  const thisMonday = mondayOf(now)
  const prevMondayDate = new Date(thisMonday + 'T00:00:00Z')
  prevMondayDate.setUTCDate(prevMondayDate.getUTCDate() - 7)
  const weekStart = prevMondayDate.toISOString().slice(0, 10)

  // Bornes de la semaine traitée (lundi -> dimanche inclus).
  const weekEndDate = new Date(prevMondayDate)
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6)
  const weekEnd = weekEndDate.toISOString().slice(0, 10)

  // 1) Récupérer l'activité de cette semaine pour tous les membres.
  const { data: acts } = await supabase
    .from('daily_activity')
    .select('user_id, day')
    .gte('day', weekStart)
    .lte('day', weekEnd)

  // Regrouper les jours par membre.
  const daysByUser: Record<string, string[]> = {}
  for (const a of acts || []) {
    ;(daysByUser[a.user_id] ||= []).push(a.day)
  }

  // 2) Récupérer tous les profils (pour traiter aussi les inactifs : reset/grâce).
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, xp, streak_weeks')

  let validated = 0
  let bonusGiven = 0

  for (const prof of profiles || []) {
    const userDays = daysByUser[prof.id] || []
    const activeDays = countWeekdayActivity(userDays, weekStart)
    const isValidated = activeDays >= ACTIVE_DAYS_REQUIRED

    // Enregistrer / mettre à jour la ligne de la semaine.
    await supabase.from('weekly_streaks').upsert(
      { user_id: prof.id, week_start: weekStart, active_days: activeDays, validated: isValidated },
      { onConflict: 'user_id,week_start' }
    )

    // Recalculer la série avec règle de grâce :
    //  - semaine validée  -> série + 1
    //  - non validée      -> on regarde si la semaine d'AVANT était validée :
    //       * oui -> "vacille" : on conserve la série (semaine de grâce)
    //       * non -> 2 ratées d'affilée -> reset à 0
    const prevWeekDate = new Date(prevMondayDate)
    prevWeekDate.setUTCDate(prevWeekDate.getUTCDate() - 7)
    const prevWeekStart = prevWeekDate.toISOString().slice(0, 10)

    let newStreak = prof.streak_weeks ?? 0
    if (isValidated) {
      newStreak = newStreak + 1
      validated++
    } else {
      const { data: prevRow } = await supabase
        .from('weekly_streaks')
        .select('validated')
        .eq('user_id', prof.id)
        .eq('week_start', prevWeekStart)
        .maybeSingle()
      const prevValidated = prevRow?.validated === true
      if (!prevValidated) {
        newStreak = 0 // 2 semaines ratées d'affilée -> reset
      }
      // sinon : semaine de grâce, on garde newStreak inchangé
    }

    // Mettre à jour la série stockée si elle a changé.
    if (newStreak !== (prof.streak_weeks ?? 0)) {
      await supabase.from('profiles').update({ streak_weeks: newStreak }).eq('id', prof.id)
    }

    // Bonus XP de série (+50) si la semaine est validée.
    if (isValidated) {
      await supabase.from('xp_logs').insert({ user_id: prof.id, action: 'weekly_streak', xp_earned: 50 })
      await supabase.from('profiles').update({ xp: (prof.xp ?? 0) + 50 }).eq('id', prof.id)
      bonusGiven++
    }
  }

  return NextResponse.json({ ok: true, weekStart, validated, bonusGiven })
}
