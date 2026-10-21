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
    assert.equal(result.total, 1);
    assert.equal(result.offers[0].shop.address, "جمهوری، طبقه دوم");
    assert.equal(result.offers[0].inventory, "unverified");
    assert.equal(result.offers[0].paymentChannelVerified, false);
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
test("Pending tool stage resumes after a model failure without rerunning successful tools", async () => {
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
    await assert.rejects(runAgent(options));
    const stored = await repo.loadSession("a", threadId);
    assert.equal(stored.pending?.tools.length, 1);
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
      "call_inquiry",
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
