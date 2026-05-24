import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Allo Inventory — Reserve in Real-Time",
  description:
    "A real-time inventory reservation system with race-condition-safe distributed locking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fafafa] font-[family-name:var(--font-inter)]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
