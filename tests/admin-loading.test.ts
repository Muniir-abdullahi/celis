import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminPageSkeleton } from "../app/components/admin/admin-page-skeleton";

test("every admin loading shape exposes a single accessible loading status", () => {
  for (const variant of ["roles", "dashboard", "table", "settings", "detail"] as const) {
    const html = renderToStaticMarkup(createElement(AdminPageSkeleton, { variant }));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Loading page\. Please wait\./);
    assert.match(html, /motion-reduce:animate-none/);
  }
});
