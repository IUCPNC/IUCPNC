import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IUC Monthly Performance Check-In",
  description: "Integrated employee submission and People & Culture live-tracking workspace.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/iuc-logo.png",
    shortcut: "/iuc-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
