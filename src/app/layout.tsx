import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dragonzord — Scroll Video",
  description: "Scroll-scrubbed Dragonzord cinematic reveal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("[layout] RootLayout render — Archivo + Dragonzord metadata");

  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
