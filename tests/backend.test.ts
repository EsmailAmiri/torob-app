import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Repository, BusyError } from "../server/repository";
import { sqliteAdapter } from "../server/sqlite";
import { runAgent } from "../server/agent";
import { contextSchema, executeTool } from "../server/tools";
import { handleApi } from "../server/api";
import type { Product } from "../server/types";
import { groundPrices } from "../server/grounding";
test("Local nearby request keeps the selected product and changes seller location", async () => {
  const { db, repo } = await fixture();
  try {
    const threadId = randomUUID();
    const reply = await runAgent({
      repo,
      env: {},
      owner: "a",
      threadId,
      requestId: randomUUID(),
      message: "فروشگاه نزدیک جمهوری",
      context: contextSchema.parse({ selectedId: id("product", 1) }),
    });
    assert.equal(reply.tools[0].name, "find_sellers");
    assert.equal(reply.actions[1].type, "select");
    assert.equal(
      (await repo.loadSession("a", threadId)).context?.place,
      "جمهوری",
    );
  } finally {
    db.close();
  }
});
test("Seller ordering stays separate from product sorting and updates screen filters", async () => {
  const { db, repo } = await fixture();
  try {
    const tool = await executeTool(
      "find_sellers",
      {
        productId: id("product", 1),
        sort: "distance",
        place: "جمهوری",
        radius: 1,
      },
      repo,
      {
        owner: "a",
        thread: randomUUID(),
        callId: "sellers",
        context: contextSchema.parse({ sort: "recommended" }),
      },
    );
    assert.equal(tool.context.sort, "recommended");
    assert.equal(tool.context.place, "جمهوری");
    assert.equal(tool.result.total, 1);
    assert.equal(tool.actions[0].type, "search");
    assert.equal(tool.actions[1].type, "select");
  } finally {
    db.close();
  }
});
test("Hosted repository keeps SQL compact and loads complete detail from assets", async () => {
  const { db, sql, repo } = await fixture();
  try {
    const original = await repo.product(id("product", 1));
    let loads = 0;
    const hosted = new Repository(sql, async (product) => {
      loads++;
      assert.equal(product, original.id);
      return original;
    });
    await hosted.importProducts("00", { [original.id]: original });
    const [row] = await sql.all("SELECT detail FROM products WHERE id=?", [
      original.id,
    ]);
    assert.equal(JSON.parse(row.detail).offers, undefined);
    assert.equal((await hosted.product(original.id)).offers?.length, 2);
    assert.equal(loads, 1);
  } finally {
    db.close();
  }
});
const id = (prefix: string, n: number) =>
  prefix + "_" + String(n).padStart(24, "0");
async function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("drizzle/0000_mature_spot.sql", "utf8"));
  const sql = sqliteAdapter(db),
    repo = new Repository(sql);
  const products: Record<string, Product> = {};
  for (let n = 1; n <= 3; n++) {
    const p: Product = {
      id: id("product", n),
      title:
        n === 1
          ? "گوشی سامسونگ A56 128"
          : n === 2
            ? "گوشی سامسونگ A56 256"
            : "گوشی شیائومی Redmi",
      category: "گوشی موبایل",
      brand: n < 3 ? "سامسونگ" : "شیائومی",
      price: n === 3 ? null : n * 10000000,
      maxPrice: n * 11000000,
      image: null,
      count: 2,
      specs: [{ key: "حافظه", value: n === 1 ? "128" : "256" }],
      offers: [
        {
          id: id("offer", n),
          shop: id("shop", 1),
          price: n * 10000000,
          changed: null,
        },
        {
          id: id("offer", n + 10),
          shop: id("shop", 2),
          price: n * 11000000,
          changed: null,
        },
      ],
    };
    products[p.id] = p;
  }
  await repo.importProducts("00", products);
  await repo.importShops({
    [id("shop", 1)]: {
      shop_id: id("shop", 1),
      name: "فروشگاه نمونه",
      lat: 35.695,
      lon: 51.407,
      address: "جمهوری، طبقه دوم",
      weekly_hours: null,
      payment_options: [{ provider_name: "ترب‌پی", channel: "unknown" }],
    },
    [id("shop", 2)]: {
      shop_id: id("shop", 2),
      name: "فروشگاه دوم",
      lat: 35.757,
      lon: 51.409,
      address: "ونک",
      weekly_hours: null,
      payment_options: [],
    },
  });
  return { db, sql, repo };
}
test("Exact phone category excludes accessory matches and alternatives keep the category and radius", async () => {
  const { db, repo } = await fixture();
  try {
    const accessory = {
      ...(await repo.product(id("product", 1))),
      id: id("product", 9),
      title: "باتری گوشی سامسونگ A56",
      category: "باتری گوشی موبایل",
      price: 1000,
    };
    await repo.importProducts("01", { [accessory.id]: accessory });
    const search = await repo.search({
      query: "گوشی سامسونگ A56",
      budget: 15000000,
    });
    assert.equal(search.total, 1);
    assert.equal(search.products[0].category, "گوشی موبایل");
    const alternatives = await repo.alternatives(
      id("product", 1),
      25000000,
      id("shop", 1),
      { place: "جمهوری", radius: 1 },
    );
    assert.equal(alternatives.sameProductSellers.length, 0);
    assert.ok(alternatives.products.every((p) => p.category === "گوشی موبایل"));
  } finally {
    db.close();
  }
});
test("Strict credit accepts declared in-person only, and uses the actual user position", async () => {
  const { db, repo } = await fixture();
  try {
    const shop = await repo.shop(id("shop", 1));
    for (const channel of ["unknown", "online", "in_person"]) {
      await repo.importShops({
        [shop.shop_id]: {
          ...shop,
          payment_options: [{ provider_name: "ترب‌پی", channel }],
        },
      });
      const sellers = await repo.sellers({
        productId: id("product", 1),
        installment: true,
        position: [35.695, 51.407],
        radius: 1,
      });
      assert.equal(sellers.total, channel === "in_person" ? 1 : 0);
      if (sellers.total) {
        assert.equal(sellers.offers[0].paymentChannelDeclared, true);
        assert.equal(sellers.offers[0].paymentChannelVerified, false);
      }
    }
  } finally {
    db.close();
  }
});
test("Step limit finalises even when the provider ignores tool_choice and the next turn remains usable", async () => {
  const { db, repo } = await fixture();
  const threadId = randomUUID();
  let calls = 0;
  const model = {
    async respond() {
      calls++;
      return [
        {
          type: "function_call",
          call_id: "repeat_" + calls,
          name: "search_products",
          arguments: '{"query":"گوشی"}',
        },
      ];
    },
  };
  try {
    const reply = await runAgent({
      repo,
      env: {},
      owner: "a",
      threadId,
      requestId: randomUUID(),
      context: contextSchema.parse({}),
      message: "گوشی",
      model,
    });
    assert.equal(calls, 4);
    assert.equal(reply.tools.length, 3);
    assert.match(reply.text, /قیمت|تومان/);
    assert.equal((await repo.loadSession("a", threadId)).pending, undefined);
    const next = await runAgent({
      repo,
      env: {},
      owner: "a",
      threadId,
      requestId: randomUUID(),
      context: contextSchema.parse({}),
      message: "سلام",
      model: {
        async respond() {
          return [
            {
              type: "message",
              content: [{ type: "output_text", text: "سلام" }],
            },
          ];
        },
      },
    });
    assert.equal(next.text, "سلام");
  } finally {
    db.close();
  }
});
test("Price grounding repairs factor-ten errors in Persian text and Markdown cells and removes invented monetary values", () => {
  const input = [
    {
      type: "function_call_output",
      output: JSON.stringify({
        products: [{ price: 116800000, maxPrice: 156000000 }],
      }),
    },
  ];
  assert.equal(groundPrices("۱۱٬۶۸۰٬۰۰۰ تومان", input), "۱۱۶٬۸۰۰٬۰۰۰ تومان");
  assert.equal(groundPrices("| 11,680,000 |", input), "| ۱۱۶٬۸۰۰٬۰۰۰ |");
  assert.equal(groundPrices("۱۱٫۶۸ میلیون تومان", input), "۱۱۶٬۸۰۰٬۰۰۰ تومان");
  assert.equal(
    groundPrices("۱۱۶ میلیون و ۸۰۰ هزار تومان", input),
    "۱۱۶ میلیون و ۸۰۰ هزار تومان",
  );
  assert.equal(
    groundPrices("قیمت ۹۹ میلیون تومان", input),
    "قیمت قیمت ثبت‌شده در کارت نتیجه",
  );
  assert.equal(
    groundPrices("بودجه ۶۰ میلیون تومان", input, 60000000),
    "بودجه ۶۰ میلیون تومان",
  );
});
test("Market fallback rechecks matching catalogue products and returns sourced approximate map areas", async () => {
  const { db, repo } = await fixture();
  const ctx = {
    owner: "a",
    thread: randomUUID(),
    callId: "market",
    context: contextSchema.parse({}),
  };
  try {
    const known = await executeTool(
      "suggest_market_areas",
      { query: "سامسونگ A56" },
      repo,
      ctx,
    );
    assert.equal(known.result.catalogue.total, 2);
    const missing = await executeTool(
      "suggest_market_areas",
      { query: "دوربین Bolex H16" },
      repo,
      ctx,
    );
    assert.equal(missing.result.catalogue.total, 0);
    assert.equal(missing.actions[0].type, "markets");
    assert.equal(missing.result.areas[0].provenance, "external");
    assert.equal(missing.result.areas[0].position.length, 2);
  } finally {
    db.close();
  }
});
test("Mock no-answer returns actionable alternatives, excludes failed shop, persists history and keeps inventory unverified", async () => {
  const { db, repo } = await fixture();
  const thread = randomUUID();
  try {
    await repo.lock("a", thread);
    await repo.saveSession("a", thread, {
      history: [],
      context: contextSchema.parse({ place: "جمهوری", radius: 30 }),
    });
    await repo.unlock("a", thread);
    const inquiry = await repo.inquiry(
      "a",
      thread,
      id("product", 1),
      id("offer", 1),
      "provider-tool-call",
    );
    assert.match(inquiry.id, /^[a-f0-9-]{36}$/);
    const response = await repo.simulate("a", inquiry.id, "noanswer_demo");
    assert.equal(response.inventory, "unverified");
    const sellers = response.actions.find((a) => a.type === "sellers");
    assert.equal(sellers.offers.length, 1);
    assert.equal(sellers.offers[0].shop.shop_id, id("shop", 2));
    const state = await repo.loadSession("a", thread);
    assert.equal(state.history.length, 1);
    assert.deepEqual(state.context?.excludedShopIds, [id("shop", 1)]);
    await repo.simulate("a", inquiry.id, "noanswer_demo");
    assert.equal((await repo.loadSession("a", thread)).history.length, 1);
  } finally {
    db.close();
  }
});
test("Inquiry simulation uses the current page budget and radius rather than stale chat filters", async () => {
  const { db, repo } = await fixture();
  try {
    const inquiry = await repo.inquiry(
      "a",
      randomUUID(),
      id("product", 1),
      id("offer", 1),
      "simulation-context",
    );
    const result = await repo.simulate(
      "a",
      inquiry.id,
      "unavailable_demo",
      contextSchema.parse({ budget: 15000000, place: "جمهوری", radius: 1 }),
    );
    assert.equal(
      result.actions.find((a) => a.type === "sellers").offers.length,
      0,
    );
    assert.ok(
      result.actions
        .find((a) => a.type === "results")
        .products.every((p: any) => p.price <= 15000000),
    );
  } finally {
    db.close();
  }
});
test("SQLite FTS searches normalized Persian; budget excludes unknown prices", async () => {
  const { db, repo } = await fixture();
  try {
    const r = await repo.search({
      query: "گوشي",
      brand: "سامسونگ",
      budget: 15000000,
    });
    assert.equal(r.total, 1);
    assert.equal(r.products[0].id, id("product", 1));
    assert.equal(
      (await repo.search({ query: "گوشی", sort: "price" })).products.at(-1)
        ?.price,
      null,
    );
    assert.equal(
      (await repo.search({ query: '"; DROP TABLE products;--' })).total,
      0,
    );
    assert.equal((await repo.search({ query: "گوشی" })).total, 3);
  } finally {
    db.close();
  }
});
test("Sellers come from exact offers and unknown credit channel is not verified", async () => {
  const { db, repo } = await fixture();
  try {
    const result = await repo.sellers({
      productId: id("product", 1),
      place: "جمهوری",
      radius: 1,
      installment: true,
    });
    assert.equal(result.total, 0);
    const unfiltered = await repo.sellers({
      productId: id("product", 1),
      place: "جمهوری",
      radius: 1,
    });
    assert.equal(unfiltered.offers[0].inventory, "unverified");
    assert.equal(unfiltered.offers[0].paymentChannelVerified, false);
  } finally {
    db.close();
  }
});
test("LangGraph runs model → validated tool → model and persists complete tool history", async () => {
  const { db, repo } = await fixture();
  const threadId = randomUUID(),
    requestId = randomUUID();
  let calls = 0;
  const model = {
    async respond(input: any[]) {
      calls++;
      if (calls === 1)
        return [
          { type: "reasoning", id: "reason-1", summary: [] },
          {
            type: "function_call",
            name: "search_products",
            call_id: "call_search",
            arguments: JSON.stringify({
              query: "گوشی موبایل",
              budget: 15000000,
              brand: "سامسونگ",
            }),
          },
        ];
      assert.ok(input.some((o) => o.type === "reasoning"));
      const output = input.find((o) => o.type === "function_call_output");
      assert.equal(JSON.parse(output.output).total, 1);
      return [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "یک محصول با قیمت ثبت‌شده ۱۰ میلیون تومان پیدا شد؛ موجودی تأیید نشده است.",
            },
          ],
        },
      ];
    },
  };
  try {
    const reply = await runAgent({
      repo,
      env: {},
      owner: "a",
      threadId,
      requestId,
      message: "گوشی تا ۱۵ میلیون",
      context: contextSchema.parse({}),
      model,
    });
    assert.equal(reply.provider, "llm");
    assert.equal(calls, 2);
    assert.equal(reply.actions[0].type, "search");
    assert.equal(reply.tools[0].status, "ok");
    const state = await new Repository(repo.db).loadSession("a", threadId);
    assert.ok(
      state.history.flat().some((o) => o.type === "function_call_output"),
    );
    const cached = await runAgent({
      repo,
      env: {},
      owner: "a",
      threadId,
      requestId,
      message: "تکرار",
      context: contextSchema.parse({}),
      model,
    });
    assert.equal(cached.text, reply.text);
    assert.equal(calls, 2);
    assert.deepEqual(
      (await repo.loadSession("other-user", threadId)).history,
      [],
    );
  } finally {
    db.close();
  }
});
test("A model summary failure returns usable grounded results without trapping the thread", async () => {
  const { db, repo } = await fixture();
  const threadId = randomUUID(),
    requestId = randomUUID();
  let calls = 0;
  const model = {
    async respond() {
      calls++;
      if (calls === 1)
        return [
          {
            type: "function_call",
            name: "search_products",
            call_id: "safe_call",
            arguments: '{"query":"گوشی"}',
          },
        ];
      throw Error("temporary provider failure");
    },
  };
  const options = {
    repo,
    env: {},
    owner: "a",
    threadId,
    requestId,
    message: "گوشی",
    context: contextSchema.parse({}),
    model,
  };
  try {
    const first = await runAgent(options);
    assert.match(first.text, /گوشی/);
    const stored = await repo.loadSession("a", threadId);
    assert.equal(stored.pending, undefined);
    const reply = await runAgent({
      ...options,
      model: {
        async respond(input) {
          assert.equal(
            input.filter((o) => o.type === "function_call_output").length,
            1,
          );
          return [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: "نتایج آماده است." }],
            },
          ];
        },
      },
    });
    assert.equal(reply.tools.length, 1);
    assert.equal((await repo.loadSession("a", threadId)).pending, undefined);
  } finally {
    db.close();
  }
});
test("No key produces an explicitly local answer using database tools", async () => {
  const { db, repo } = await fixture();
  try {
    const reply = await runAgent({
      repo,
      env: {},
      owner: "a",
      threadId: randomUUID(),
      requestId: randomUUID(),
      message: "گوشی سامسونگ تا ۱۵ میلیون",
      context: contextSchema.parse({}),
    });
    assert.equal(reply.provider, "local");
    assert.match(reply.text, /کلید مدل/);
    assert.equal(reply.actions[0].type, "search");
  } finally {
    db.close();
  }
});
test("Inquiry creation and simulation never claim real contact or stock", async () => {
  const { db, repo } = await fixture();
  try {
    const result = await executeTool(
      "request_inquiry",
      { productId: id("product", 1), offerId: id("offer", 1) },
      repo,
      {
        owner: "a",
        thread: randomUUID(),
        callId: "call_inquiry",
        context: contextSchema.parse({}),
      },
    );
    assert.equal(result.result.status, "not_contacted");
    assert.equal(result.result.inventory, "unverified");
    await assert.rejects(repo.simulate("b", "call_inquiry", "available_demo"));
    const simulated = await repo.simulate(
      "a",
      result.result.id,
      "available_demo",
    );
    assert.equal(simulated.inventory, "unverified");
  } finally {
    db.close();
  }
});
test("Concurrent turns are locked and input, origin and admin import are validated", async () => {
  const { db, repo, sql } = await fixture();
  try {
    const thread = randomUUID();
    await repo.lock("a", thread);
    await assert.rejects(repo.lock("a", thread), BusyError);
    await repo.unlock("a", thread);
    const options = { db: sql, env: {}, owner: "a" };
    let response = await handleApi(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: "{}",
      }),
      options,
    );
    assert.equal(response.status, 403);
    response = await handleApi(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      options,
    );
    assert.equal(response.status, 400);
    response = await handleApi(
      new Request("http://localhost/api/admin/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"shard":"00"}',
      }),
      options,
    );
    assert.equal(response.status, 403);
    response = await handleApi(
      new Request("http://localhost/api/health"),
      options,
    );
    const health = (await response.json()) as any;
    assert.equal(health.assistant.configured, false);
    assert.equal(JSON.stringify(health).includes("OPENAI_API_KEY"), false);
  } finally {
    db.close();
  }
});
