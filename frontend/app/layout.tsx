import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "diskHub Control Panel",
  description: "Operational dashboard for diskHouse workflows, storage inventory, and admin access"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
