import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseLegalDoc } from "../app/lib/legal-doc";

test("account deletion content retains both languages and support instructions in the shared parser", () => {
  const html = readFileSync("public/delete-account/index.html", "utf8");
  const document = parseLegalDoc(html);
  assert.match(document.title, /Delete your Celis account/);
  for (const body of [document.en, document.so]) {
    assert.match(body, /<ol>/);
    assert.match(body, /class="warn"/);
    assert.match(body, /mailto:support@celis.so\?subject=Account%20deletion%20request/);
    assert.match(body, /href="\/privacy\/"/);
    assert.doesNotMatch(body, /<style|<header|<footer/);
  }
  assert.match(document.en, /This cannot be undone/);
  assert.match(document.so, /Dib looma celin karo/);
});
