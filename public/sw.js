// Service worker Meello — gère l'installation PWA et les notifications push.
// Volontairement minimal : pas de cache offline agressif (l'app dépend de
// Supabase en temps réel), juste ce qu'il faut pour l'installation et le push.

const VERSION = 'meello-sw-v1'

self.addEventListener('install', (event) => {
  // Active immédiatement le nouveau SW sans attendre la fermeture des onglets.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Prend le contrôle des pages déjà ouvertes.
  event.waitUntil(self.clients.claim())
})

// Réception d'une notification push (app ouverte, en arrière-plan ou fermée).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Meello', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Meello'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    image: data.image || undefined,
    tag: data.tag || undefined,        // regroupe les notifs d'un même type
    renotify: !!data.tag,
    data: { url: data.url || '/' },    // URL ouverte au clic
    vibrate: [80, 40, 80],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Clic sur la notification → ouvre/réutilise l'onglet Meello sur la bonne URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si Meello est déjà ouvert, on le ramène au premier plan et on navigue.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(targetUrl)
          return
        }
      }
      // Sinon on ouvre une nouvelle fenêtre.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
