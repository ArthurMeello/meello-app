// @ts-nocheck
'use client'

// Affiche une pièce jointe dans un message :
// - image : aperçu cliquable (ouvre en plein écran dans un nouvel onglet)
// - fichier : pastille téléchargeable avec le nom

export default function AttachmentView({ url, name, type, light }: { url: string; name?: string; type?: string; light?: boolean }) {
  if (!url) return null

  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '0.4rem', maxWidth: '240px' }}>
        <img src={url} alt={name || 'image'} style={{ width: '100%', borderRadius: '12px', display: 'block' }} />
      </a>
    )
  }

  // Fichier : pastille téléchargeable
  const fg = light ? 'rgba(255,255,255,0.95)' : '#2D2D2D'
  const bg = light ? 'rgba(255,255,255,0.18)' : '#F1EFE8'
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', backgroundColor: bg, color: fg, borderRadius: '10px', padding: '0.5rem 0.7rem', textDecoration: 'none', maxWidth: '240px' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
      <span style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Fichier'}</span>
    </a>
  )
}
