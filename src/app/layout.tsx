// @ts-nocheck
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const clashDisplay = localFont({
  src: "../../public/fonts/ClashDisplay-Variable.woff2",
  variable: "--font-clash",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Meello — La communauté des entrepreneurs francophones",
  description: "Meello est une communauté sélective pour entrepreneurs et freelances francophones. Recommandations, entraide, mise en relation.",
  icons: {
    icon: "/favicon-meello.png",
    apple: "/favicon-meello.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Meello",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F0E8",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Le contenu se redimensionne avec le clavier virtuel au lieu de
  // décaler le layout (évite le décalage résiduel après fermeture).
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={clashDisplay.variable}>
      <body style={{ margin: 0, fontFamily: "'General Sans', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased' }}>
        {children}
      </body>
    </html>
  );
}
