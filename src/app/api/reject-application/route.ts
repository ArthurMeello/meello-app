import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailTemplate } from '@/lib/emailTemplate'

const MOTIFS = {
  info: {
    label: 'Informations insuffisantes',
    body: `Après examen de ta candidature, nous n'avons pas pu retenir ta demande car les informations fournies sur ton activité sont insuffisantes pour évaluer ta candidature. N'hésite pas à soumettre une nouvelle candidature en détaillant davantage ton projet, ton métier et ta motivation à rejoindre la communauté.`,
  },
  profil: {
    label: 'Profil non compatible',
    body: `Après examen de ta candidature, nous n'avons pas pu retenir ta demande car ton profil ne correspond pas aux critères de la communauté Meello à ce stade. Meello s'adresse avant tout aux entrepreneurs, freelances et indépendants ayant une activité lancée. Si ta situation évolue, tu es libre de soumettre une nouvelle candidature.`,
  },
  activite: {
    label: 'Activité exclue',
    body: `Après examen de ta candidature, nous ne pouvons pas donner suite à ta demande. Meello n'accueille pas les activités de type vente directe, réseau de mandataires, ou marketing de réseau (MLM). Cette décision est définitive.`,
  },
}

export async function POST(req: Request) {
  const { app, motif } = await req.json()

  const motifData = MOTIFS[motif as keyof typeof MOTIFS]
  if (!motifData) return NextResponse.json({ error: 'Motif invalide' }, { status: 400 })

  // Mettre à jour le statut en BDD
  const supabase = createAdminClient()
  await supabase.from('applications').update({ status: 'rejected' }).eq('id', app.id)

  // Envoyer l'email via Brevo
  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'bonjour@meello.fr' },
      to: [{ email: app.email, name: `${app.first_name} ${app.last_name}` }],
      subject: 'Ta candidature Meello',
      htmlContent: emailTemplate({
        firstName: app.first_name,
        body: motifData.body,
      }),
    }),
  })

  if (!brevoRes.ok) {
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
