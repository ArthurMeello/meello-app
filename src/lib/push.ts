// @ts-nocheck
// Helper serveur pour envoyer des notifications push Web Push à un membre.
// Utilisé par les routes API (ex: nouveau message, événement, etc.).
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@meello.fr',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

/**
 * Envoie une notification à tous les appareils d'un membre.
 * payload : { title, body, url?, icon?, image?, tag? }
 * Les abonnements expirés (404/410) sont supprimés automatiquement.
 */
export async function sendPushToUser(userId: string, payload: object) {
  configure()
  const supabase = createAdminClient()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subs?.length) return { sent: 0 }

  const body = JSON.stringify(payload)
  let sent = 0

  await Promise.all(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        await webpush.sendNotification(subscription, body)
        sent++
      } catch (err: any) {
        // 404/410 = abonnement révoqué ou expiré → on nettoie.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        } else {
          console.error('[push] envoi échoué', err?.statusCode, err?.body)
        }
      }
    })
  )

  return { sent }
}
