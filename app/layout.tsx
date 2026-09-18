import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, appUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    // Child pages supply their own title; this keeps the brand suffixed.
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    url: appUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    creator: "@ahmmikun",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div className="site-shell">
          <NavBar />
          <div id="main-content" className="site-main">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
