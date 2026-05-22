// @ts-nocheck
import AppNav from '@/components/AppNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F0E8' }}>
      <AppNav />
      <main style={{ marginLeft: '220px', flex: 1, padding: '2rem', maxWidth: '100%' }}>
        {children}
      </main>
      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding-bottom: 5rem !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
