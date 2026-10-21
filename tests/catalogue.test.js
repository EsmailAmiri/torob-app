import test from "node:test";
import assert from "node:assert/strict";
import {
  hoursStatus,
  parseRequest,
  distance,
  normalize,
} from "../src/catalogue.js";

test("Persian request applies budget, brand and neighbourhood together", () => {
  assert.deepEqual(parseRequest("گوشی سامسونگ تا ۱۲۰ میلیون نزدیک جمهوری"), {
    budget: 120000000,
    near: true,
    place: "جمهوری",
    query: "گوشی موبایل",
    brand: "سامسونگ",
  });
  assert.equal(parseRequest("لپ تاپ زیر ١٢.٥ میلیون").budget, 12500000);
  assert.equal(parseRequest("بدون قسط").installment, false);
});
test("Search normalizes Persian/Arabic characters, digits and half spaces", () => {
  assert.equal(normalize("كالا ي ۱۲٣"), "کالا ی 123");
  assert.equal(normalize("لپ‌تاپ"), "لپ تاپ");
});
const shift = (start, end) => ({
  status: "declared",
  shifts: [{ start_time: start, end_time: end }],
});
test("Opening hours use Tehran time, not execution host timezone", () => {
  const shop = { weekly_hours: { mon: shift("10:00:00", "19:00:00") } };
  assert.equal(
    hoursStatus(shop, new Date("2026-10-19T07:00:00Z")).state,
    "open",
  );
  assert.equal(
    hoursStatus(shop, new Date("2026-10-19T15:30:00Z")).state,
    "closed",
  );
  assert.equal(hoursStatus({}, new Date()).state, "unknown");
});
test("Overnight opening belongs to preceding day even if next day is closed", () => {
  const shop = {
    weekly_hours: {
      sun: shift("22:00:00", "02:00:00"),
      mon: { status: "closed" },
    },
  };
  assert.equal(
    hoursStatus(shop, new Date("2026-10-19T01:00:00+03:30")).state,
    "open",
  );
  assert.equal(
    hoursStatus(shop, new Date("2026-10-19T02:00:00+03:30")).state,
    "closed",
  );
  const mondayOnly = { weekly_hours: { mon: shift("22:00:00", "02:00:00") } };
  assert.equal(
    hoursStatus(mondayOnly, new Date("2026-10-19T01:00:00+03:30")).state,
    "closed",
  );
  assert.equal(
    hoursStatus(mondayOnly, new Date("2026-10-19T23:00:00+03:30")).state,
    "open",
  );
});
test("Distance is geographic and symmetric", () => {
  assert.equal(distance([35.7, 51.4], [35.7, 51.4]), 0);
  const a = [35.757, 51.409],
    b = [35.695, 51.407];
  assert.ok(distance(a, b) > 6 && distance(a, b) < 8);
  assert.equal(distance(a, b), distance(b, a));
});
