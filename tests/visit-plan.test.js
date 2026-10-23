import assert from "node:assert/strict";
import { test } from "node:test";
import { visitPlan } from "../src/visit-plan.js";

const at = new Date("2026-10-23T12:00:00Z");
const allDays = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
const hours = (status) => Object.fromEntries(allDays.map((day) => [day, status === "open" ? { status: "declared", shifts: [{ start_time: "00:00", end_time: "23:59" }] } : { status: "closed" }]));
const offer = (id, distance, state, price = 100) => ({ id, distance, price, shop: { name: id, weekly_hours: state === "unknown" ? null : hours(state), payment_options: [] } });
const options = { center: [35.695, 51.412], radius: 2, budget: "", installment: false, onlyOpen: false, query: "شارژر موبایل" };

test("suggests the nearest declared open offer beyond the radius and a sourced area", () => {
  const result = visitPlan([offer("closed", 0.5, "closed"), offer("far", 4, "open"), offer("unknown", 1, "unknown")], options, at);
  assert.equal(result.nearbyOpen, undefined);
  assert.equal(result.outsideOpen.id, "far");
  assert.equal(result.unknown.id, "unknown");
  assert.equal(result.area.id, "digital");
});

test("respects price and in-person payment while selecting an open shop", () => {
  const credit = { ...offer("credit", 1, "open", 80), shop: { ...offer("credit", 1, "open").shop, payment_options: [{ channel: "in_person" }] } };
  const result = visitPlan([offer("expensive", 0.2, "open", 500), offer("cash", 0.5, "open", 70), credit], { ...options, budget: 100, installment: true }, at);
  assert.equal(result.nearbyOpen.id, "credit");
});

test("does not present unknown hours as open under the open-only filter", () => {
  const result = visitPlan([offer("unknown", 1, "unknown")], { ...options, onlyOpen: true }, at);
  assert.equal(result.nearbyOpen, undefined);
  assert.equal(result.unknown, null);
});

test("uses sourced external areas for books and home appliances without an offer claim", () => {
  assert.equal(visitPlan([], { ...options, query: "کتاب دانشگاهی" }, at).area.id, "books");
  assert.equal(visitPlan([], { ...options, query: "یخچال فریزر" }, at).area.id, "home-appliances");
});
