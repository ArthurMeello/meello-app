// Helper client : attribue des XP pour une action, via la route serveur.
// Silencieux et non bloquant : un échec ne doit jamais gêner l'action utilisateur.
//
// userId : par défaut, l'utilisateur courant côté serveur ? Non : la route attend
//          un userId explicite (celui qui AGIT). On le passe donc toujours.
//
// Actions valides (voir src/app/api/award-xp/route.ts) :
//   profile_completed, first_service,
//   comment_post, like_post, poll_vote,
//   event_joined, event_created,
//   connection_accepted, daily_login, weekly_streak

export async function awardXp(userId: string, action: string): Promise<void> {
  if (!userId || !action) return
  try {
    await fetch('/api/award-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    })
  } catch {
    // silencieux
  }
}
