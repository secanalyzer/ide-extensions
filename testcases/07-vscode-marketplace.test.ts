// ONLINE — gated behind RUN_ONLINE_TESTS=1. Verifies the live VS Code
// Marketplace returns the expected metadata shape and the two key
// origin-classification cases from the design plan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchVscodeMetadata } from "../src/vscode/marketplace.ts";
import { isOnline } from "./helpers.ts";

test("Marketplace returns metadata for ms-python.python with origin=official", { skip: !isOnline() }, async () => {
  const meta = await fetchVscodeMetadata(["ms-python.python"]);
  const python = meta.get("ms-python.python");
  assert.ok(python, "ms-python.python metadata returned");
  assert.equal(python!.origin, "official");
  assert.ok((python!.installs ?? 0) > 100_000_000, "installs > 100M");
  assert.ok(typeof python!.rating === "number", "rating is numeric");
  assert.equal(python!.publisherDomain, "https://microsoft.com");
});

test("alefragnani.bookmarks is classified as individual (no verified domain)", { skip: !isOnline() }, async () => {
  const meta = await fetchVscodeMetadata(["alefragnani.bookmarks"]);
  const bookmarks = meta.get("alefragnani.bookmarks");
  assert.ok(bookmarks, "alefragnani.bookmarks metadata returned");
  assert.equal(bookmarks!.origin, "individual");
  assert.ok((bookmarks!.installs ?? 0) > 1_000_000, "installs > 1M (popular)");
});

test("Batched query returns multiple extensions in one round-trip", { skip: !isOnline() }, async () => {
  const ids = ["ms-python.python", "alefragnani.bookmarks", "esbenp.prettier-vscode"];
  const meta = await fetchVscodeMetadata(ids);
  // Allow for any one entry to be missing if the marketplace changes; require >= 2 hits.
  let found = 0;
  for (const id of ids) if (meta.get(id)) found++;
  assert.ok(found >= 2, `expected ≥2 metadata results, got ${found}`);
});

test("Unknown extension id silently yields no entry (no thrown error)", { skip: !isOnline() }, async () => {
  const meta = await fetchVscodeMetadata(["definitely-not-a.real-extension-xyz123"]);
  assert.equal(meta.size, 0);
});
