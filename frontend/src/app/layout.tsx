import type { Metadata } from "next";
import MinWidthGuard from "@/components/MinWidthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Drawing Coach",
  description: "Your AI coach guides every stroke",
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
