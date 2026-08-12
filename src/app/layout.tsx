import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-Runner",
  description: "Deterministic canvas platformer with editor and training mode.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
