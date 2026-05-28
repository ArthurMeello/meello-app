export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .messages-layout-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 50;
            background: white;
            overflow: hidden;
          }
        }
      `}</style>
      <div className="messages-layout-wrapper">
        {children}
      </div>
    </>
  )
}
