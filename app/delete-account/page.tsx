import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { LegalDocument } from "~/components/layout/legal-document";
import { parseLegalDoc } from "~/lib/legal-doc";

export const metadata: Metadata = {
  title: "Delete Your Account | Celis",
  description:
    "How to delete your Celis marketplace account and what happens to your data.",
};

export default async function DeleteAccountPage() {
  const html = await readFile(join(process.cwd(), "public/delete-account/index.html"), "utf8");
  return <LegalDocument {...parseLegalDoc(html)} />;
}
