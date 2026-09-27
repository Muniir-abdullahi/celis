import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { LegalDocument } from "~/components/layout/legal-document";
import { parseLegalDoc } from "~/lib/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy | Celis",
  description:
    "How Celis Somalia handles information in the buyer and seller marketplace.",
};

export default async function PrivacyPage() {
  const html = await readFile(join(process.cwd(), "public/privacy/index.html"), "utf8");
  return <LegalDocument {...parseLegalDoc(html)} />;
}
