import type { Metadata } from "next";
import "~/styles/globals.css";

export const metadata: Metadata = {
  title: "Page not found | Celis",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Celis</p>
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="text-muted-foreground">The page you are looking for does not exist.</p>
          <a className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground" href="/">
            Return to marketplace
          </a>
        </main>
      </body>
    </html>
  );
}
