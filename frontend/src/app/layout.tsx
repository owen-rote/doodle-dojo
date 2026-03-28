import type { Metadata } from "next";
import MinWidthGuard from "@/components/MinWidthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "DoodleDojo",
  description: "Learn to draw, one stroke at a time",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DoodleDojo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <MinWidthGuard>{children}</MinWidthGuard>
      </body>
    </html>
  );
}
