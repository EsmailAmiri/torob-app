import assert from "node:assert/strict";
import { test } from "node:test";
import { groundCreditSellers, groundMissingMarket } from "../server/grounding";

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

test("credit seller answer only names the declared in-person service", () => {
  const answer = groundCreditSellers(
    "اسنپ‌پی، بالن و سرویس دیگری موجود است.",
    [{ type: "select", product: { title: "گوشی A56" } }, { type: "sellers", offers: [{ shop: { name: "فروشگاه آزمون", payment_options: [{ provider_name: "اسنپ‌پی", channel: "in_person" }] }, price: 120000000, distance: 0.5, hours: { label: "طبق برنامه باز است" } }] }],
    true,
  );
  assert.match(answer, /اسنپ‌پی/);
  assert.doesNotMatch(answer, /بالن/);
  assert.match(answer, /۱۲۰٬۰۰۰٬۰۰۰/);
});
