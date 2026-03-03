import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gele AI",
  description: "Transform portraits with realistic gele styling."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
