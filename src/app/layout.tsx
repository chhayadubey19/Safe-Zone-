import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { WelcomeScreen } from "@/components/safezone/welcome-screen";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SafeZone — Bhopal Community Safety Registry",
  description:
    "Civic safety, transparent by default: venue safety records, citizen reports and inspection history for Bhopal. Safer Places. Stronger Communities.",
  // Icons come from the App Router file conventions — src/app/favicon.ico,
  // src/app/icon.png (512) and src/app/apple-icon.png (180), generated from
  // the brand app icon by scripts/make-icons.py.
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased bg-canvas text-ink">
        {children}
        <Toaster />
        <WelcomeScreen />
      </body>
    </html>
  );
}
