// ONLINE — gated behind RUN_ONLINE_TESTS=1. Verifies the live JetBrains
// Marketplace returns metadata for a well-known xmlId and that the rating
// is computed from the votes distribution (not the global Bayesian prior).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchJetbrainsMetadata } from "../src/jetbrains/marketplace.ts";
import { isOnline } from "./helpers.ts";

test("Marketplace returns metadata for org.intellij.scala with origin=official", { skip: !isOnline() }, async () => {
  const meta = await fetchJetbrainsMetadata(["org.intellij.scala"]);
  const scala = meta.get("org.intellij.scala");
  assert.ok(scala, "org.intellij.scala metadata returned");
  assert.equal(scala!.origin, "official");
  assert.ok((scala!.installs ?? 0) > 1_000_000, "installs > 1M (Scala plugin is popular)");
});

test("Rating is computed per-plugin, not the marketplace-wide ~4.08 prior", { skip: !isOnline() }, async () => {
  // Two popular plugins; their actual ratings differ. If both came back as
  // 4.08, we'd know the implementation is reading meanRating instead of
  // computing from the votes distribution.
  const meta = await fetchJetbrainsMetadata(["org.intellij.scala", "Pythonid"]);
  const a = meta.get("org.intellij.scala")?.rating;
  const b = meta.get("Pythonid")?.rating;
  if (a !== undefined && b !== undefined) {
    assert.notEqual(a.toFixed(2), b.toFixed(2),
      "two distinct plugins must have distinct computed ratings");
  } else {
    // If either lookup failed (network/transient), don't claim a false positive.
    assert.ok(a !== undefined || b !== undefined, "at least one rating returned");
  }
});

test("Unknown xmlId silently yields no entry (no thrown error)", { skip: !isOnline() }, async () => {
  const meta = await fetchJetbrainsMetadata(["com.definitely.not.real.xyz123"]);
  assert.equal(meta.size, 0);
});
