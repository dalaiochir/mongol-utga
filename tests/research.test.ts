import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPrompt,
  csvCell,
  meanScore,
  validateState,
  score,
  type Result,
} from "../lib/domain";
import { seedItems } from "../lib/seed";
test("reference answers never leak into any experimental prompt", () => {
  const item = {
    ...seedItems[0],
    expected: "SECRET_GOLD",
    source: "SECRET_SOURCE",
  };
  for (const method of ["plain", "context", "examples"] as const) {
    const p = buildPrompt(item, method);
    assert.ok(!p.includes("SECRET_GOLD"));
    assert.ok(!p.includes("SECRET_SOURCE"));
    assert.ok(p.includes(item.text));
    assert.equal(p.includes(item.context), method !== "plain");
  }
});
test("seed IDs unique and examples separated from evaluation items", () => {
  assert.equal(new Set(seedItems.map((i) => i.id)).size, 24);
  assert.ok(
    seedItems.every(
      (i) =>
        i.text !== "Нүүр хийх газаргүй болох." &&
        i.text !== "Мөн ч хурдан юм аа!",
    ),
  );
  validateState({ version: 1, items: seedItems, results: [] });
});
test("unrated responses excluded and valid zero scores retained", () => {
  const base = {
    review: {
      meaning: 0,
      context: 0,
      clarity: 0,
      reviewer: "R1",
      note: "",
      errorType: "literal",
      at: "2026-09-22",
    },
  } as Result;
  assert.equal(meanScore([{ ...base, review: undefined }]), null);
  assert.equal(meanScore([base, { ...base, review: undefined }]), 0);
  assert.equal(
    score({ ...base.review!, meaning: 2, context: 1, clarity: 2 }),
    5,
  );
});
test("CSV neutralizes spreadsheet formulas and quotes", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("  @SUM(A1)"), '"\'  @SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
test("backup import rejects duplicate IDs and invalid ratings", () => {
  assert.throws(() =>
    validateState({
      version: 1,
      items: [seedItems[0], seedItems[0]],
      results: [],
    }),
  );
  assert.throws(() => validateState({ version: 2, items: [], results: [] }));
});
