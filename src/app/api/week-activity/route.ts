// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mondayOf, ACTIVE_DAYS_REQUIRED } from '@/lib/gamification'

// Renvoie l'activité de la semaine en cours d'un membre :
// les 5 jours ouvrés (lun-ven) avec leur statut actif/inactif, le nombre de
// jours actifs, l'objectif (4), si la semaine est déjà validée, et la série.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const supabase = createAdminClient()
  const weekStart = mondayOf(new Date())

  // Les 5 dates ouvrées de la semaine (lun -> ven).
  const start = new Date(weekStart + 'T00:00:00Z')
  const weekdays: string[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    weekdays.push(d.toISOString().slice(0, 10))
  }

  // Jours actifs enregistrés cette semaine.
  const { data: acts } = await supabase
    .from('daily_activity')
    .select('day')
    .eq('user_id', userId)
    .gte('day', weekdays[0])
    .lte('day', weekdays[4])
  const activeSet = new Set((acts || []).map((a: any) => a.day))

  const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
  const days = weekdays.map((d, i) => ({ label: labels[i], date: d, active: activeSet.has(d) }))
  const activeCount = days.filter(d => d.active).length

  // Série actuelle (en semaines) depuis profiles.
  const { data: prof } = await supabase
    .from('profiles')
    .select('streak_weeks')
    .eq('id', userId)
    .single()

  return NextResponse.json({
    weekStart,
    days,
    activeCount,
    target: ACTIVE_DAYS_REQUIRED,
    validated: activeCount >= ACTIVE_DAYS_REQUIRED,
    streakWeeks: prof?.streak_weeks ?? 0,
  })
}
