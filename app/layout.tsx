import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Header } from "./_components/Header";

export const metadata: Metadata = {
  title: "strats",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans leading-relaxed text-zinc-900">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>
      </body>
    </html>
  );
}
