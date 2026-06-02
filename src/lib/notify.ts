// Helper client : crée une notification (in-app + e-mail) en respectant
// les préférences de l'utilisateur. Remplace les inserts directs dans
// la table `notifications`.
//
// type : 'message' | 'connection' | 'recommendation' | 'community'
//        (types réglables via les préférences)
//        ou tout autre type non réglable (events…), inséré tel quel.
//
// dbType : valeur réellement écrite dans notifications.type si elle diffère
//          du type fonctionnel (ex: 'mention' pour la catégorie 'community').

interface NotifyArgs {
  userId: string
  type: string
  content: string
  link?: string
  fromUserId?: string | null
  dbType?: string
}

export async function notify(args: NotifyArgs): Promise<void> {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
  } catch {
    // silencieux : l'échec d'une notif ne doit pas bloquer l'action utilisateur
  }
}
