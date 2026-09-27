import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { LegalDocument } from "~/components/layout/legal-document";
import { parseLegalDoc } from "~/lib/legal-doc";

export const metadata: Metadata = {
  title: "Terms of Service | Celis",
  description:
    "The terms that govern buying and selling on the Celis marketplace.",
};

export default async function TermsPage() {
  const html = await readFile(join(process.cwd(), "public/terms/index.html"), "utf8");
  return <LegalDocument {...parseLegalDoc(html)} />;
}
