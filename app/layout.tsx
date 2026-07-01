import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitRoasted — AI GitHub Roast Generator",
  description: "Enter a GitHub username. Get brutally judged by AI.",
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
