import assert from "node:assert/strict";
import { test } from "node:test";
import { groundMissingMarket } from "../server/grounding";

test("missing product answer only names sourced market areas", () => {
  const answer = groundMissingMarket(
    "به ناصرخسرو یا جمهوری بروید.",
    [{ type: "markets", catalogue: [], areas: [{ title: "محدوده ناصرخسرو" }] }],
    "Bolex H16",
  );
  assert.match(answer, /ناصـ?رخسرو/);
  assert.doesNotMatch(answer, /جمهوری/);
  assert.match(answer, /موجودی مدل.*تأیید نشده/);
});

test("existing catalogue results keep the model's product explanation", () => {
  const original = "مدل در دیتاست هست ولی از بودجه بالاتر است.";
  assert.equal(groundMissingMarket(original, [{ type: "markets", catalogue: [{ id: "p" }], areas: [{ title: "چارسو" }] }], "A56"), original);
});
