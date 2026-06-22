import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veltriance Procurement Platform",
  description: "AI-assisted intake, supplier management, and requisition routing for Veltriance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
