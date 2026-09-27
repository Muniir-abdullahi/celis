import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Providers } from "./providers";
import "~/styles/globals.css";

const description =
  "Celis is Somalia's marketplace for electronics, vehicles, property, fashion, livestock, and more. Buy and sell locally with mobile money.";

export const metadata: Metadata = {
  title: "Celis — Buy & sell anything in Somalia",
  description,
  openGraph: {
    siteName: "Celis",
    type: "website",
    locale: "en_SO",
    description,
  },
  twitter: { card: "summary_large_image", description },
  icons: { icon: "/celis-favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0085FF" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
        <Script
          src="https://analytics.rukun.com.so/js/pixel.js"
          data-domain="celis.so"
          data-site-id="P-EMWPFCU2C8"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
