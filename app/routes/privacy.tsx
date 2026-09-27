import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
// Canonical bilingual policy, generated from the mobile app's typed `privacy.*`
// registry (see docs/backend/mobile-account-privacy.md). Its body is rendered
// inside the Celis site chrome below; the untouched source file is still served
// verbatim at /privacy/index.html. Do not hand-edit the source file.
import { LegalDocument } from "~/components/layout/legal-document";
import { parseLegalDoc } from "~/lib/legal-doc";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy | Celis" },
      {
        name: "description",
        content:
          "How Celis Somalia handles information in the buyer and seller marketplace.",
      },
    ],
  }),
});

function PrivacyPage() {
  const [policy, setPolicy] = useState<ReturnType<typeof parseLegalDoc> | null>(null);
  useEffect(() => {
    void fetch("/privacy/index.html")
      .then((response) => response.text())
      .then((html) => setPolicy(parseLegalDoc(html)));
  }, []);
  return policy ? <LegalDocument {...policy} /> : null;
}
