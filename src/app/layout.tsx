// @ts-nocheck
import type { Metadata } from "next";
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
    icon: "/favicon-meello.webp",
    apple: "/favicon-meello.webp",
  },
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
