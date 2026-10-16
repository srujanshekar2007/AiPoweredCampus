import type { Metadata } from "next";
import "./globals.css";

// The root document owns shared metadata and global design tokens for every role.
export const metadata: Metadata = {
  title: "EcoTwin | Sustainable Campus",
  description: "One campus workspace for maintenance and sustainability operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
