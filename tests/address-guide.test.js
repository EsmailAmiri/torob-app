import assert from "node:assert/strict";
import { test } from "node:test";
import { addressGuide } from "../src/address-guide.js";

test("extracts only building, floor and unit stated in a real style address", () => {
  assert.deepEqual(addressGuide("خیابان حافظ، بازار موبایل ایران، طبقه زیر همکف، پلاک ۱۲۲"), {
    building: "بازار موبایل ایران",
    floor: "طبقه زیر همکف",
    unit: "پلاک ۱۲۲",
  });
});

test("omits an indoor guide when the address has no indoor details", () => {
  assert.equal(addressGuide("خیابان جمهوری، جنب بانک"), null);
  assert.equal(addressGuide("خیابان جمهوری، پلاک ۷۲۶"), null);
});
