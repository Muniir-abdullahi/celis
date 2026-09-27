import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
// Bilingual terms of service authored for celis.so (pending qualified legal
// review). Its body is rendered inside the Celis site chrome below; the source
// file is also served verbatim at /terms/index.html.
import { LegalDocument } from "~/components/layout/legal-document";
import { parseLegalDoc } from "~/lib/legal-doc";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service | Celis" },
      {
        name: "description",
        content:
          "The terms that govern buying and selling on the Celis marketplace.",
      },
    ],
  }),
});

function TermsPage() {
  const [terms, setTerms] = useState<ReturnType<typeof parseLegalDoc> | null>(null);
  useEffect(() => {
    void fetch("/terms/index.html")
      .then((response) => response.text())
      .then((html) => setTerms(parseLegalDoc(html)));
  }, []);
  return terms ? <LegalDocument {...terms} /> : null;
}
