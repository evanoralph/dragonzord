import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dragon — Scroll Video",
  description: "Scroll-scrubbed cinematic video demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
