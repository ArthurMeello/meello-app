// Compte fantôme : invisible pour tout le monde sauf l'admin.
export const GHOST_ID = 'da8f0dfc-a63e-4fc3-a547-1558b638f057'
export const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

// true si l'id donné doit être masqué pour l'utilisateur courant
export function isHidden(id: string | null | undefined, viewerId: string | null | undefined): boolean {
  if (!id) return false
  if (viewerId === ADMIN_ID) return false // l'admin voit tout
  return id === GHOST_ID
}

// Filtre une liste d'objets en retirant ceux du ghost (sauf pour l'admin).
// `keyFn` extrait l'id pertinent de chaque élément.
export function filterGhost<T>(items: T[], keyFn: (item: T) => string | null | undefined, viewerId: string | null | undefined): T[] {
  if (viewerId === ADMIN_ID) return items
  return items.filter(it => keyFn(it) !== GHOST_ID)
}
