import { z } from "zod";
import { places } from "../src/catalogue.js";
import { Repository, productId, shopId, searchSchema } from "./repository";
import type { Action, SearchContext } from "./types";
const place = z.enum(Object.keys(places) as [string, ...string[]]);
export const contextSchema = z.object({
  query: z.string().max(160).default("گوشی موبایل"),
  budget: z.number().positive().max(1e13).nullable().default(null),
  brand: z.string().max(80).default(""),
  place: place.default("مرکز تهران"),
  radius: z.number().min(1).max(30).default(30),
  installment: z.boolean().default(false),
  onlyOpen: z.boolean().default(false),
  sort: z.enum(["recommended", "price"]).default("recommended"),
  selectedId: productId.nullable().default(null),
  compareIds: z.array(productId).max(3).default([]),
});
const schemas = {
  search_products: searchSchema.omit({ offset: true, limit: true }).extend({
    place: place.optional(),
    radius: z.number().min(1).max(30).optional(),
    installment: z.boolean().optional(),
    onlyOpen: z.boolean().optional(),
  }),
  compare_products: z.object({ productIds: z.array(productId).min(2).max(3) }),
  find_sellers: z.object({
    productId,
    place: place.optional(),
    radius: z.number().min(1).max(30).optional(),
    installment: z.boolean().optional(),
    onlyOpen: z.boolean().optional(),
    sort: z.enum(["price", "distance"]).optional(),
  }),
  get_shop_details: z.object({ shopId }),
  request_inquiry: z.object({
    productId,
    offerId: z.string().regex(/^offer_[a-f0-9]{24}$/),
  }),
  find_alternatives: z.object({
    productId,
    budget: z.number().positive().max(1e13).nullable().optional(),
    excludeShopId: shopId.optional(),
  }),
};
const descriptions = {
  search_products:
    "Search the real Torob catalogue. Query must be a concise category/model, not the whole user sentence. Changes product filters on screen. Prices in toman.",
  compare_products:
    "Compare actual registered specifications for 2–3 product IDs and open comparison on screen.",
  find_sellers:
    "Find sellers that have an offer for this exact product; includes price, straight-line distance, declared hours and unknown inventory. Opens product sellers on screen.",
  get_shop_details:
    "Get a real dataset shop address, hours and payment services; names may be fictitious and phone numbers are deliberately omitted.",
  request_inquiry:
    "Create a clearly labelled SIMULATION inquiry only. Does NOT contact anyone and does NOT confirm inventory. Use an actual offer ID from find_sellers.",
  find_alternatives:
    "Find other offers for the same product and other models in the same category. Never treats category membership as confirmed stock.",
};
const summary = (p: any) => {
  const { offers, specs, ...rest } = p;
  return rest;
};
export const toolDefinitions = Object.entries(schemas).map(
  ([name, schema]) => ({
    type: "function" as const,
    name,
    description: descriptions[name as keyof typeof descriptions],
    parameters: z.toJSONSchema(schema, { target: "draft-7" }),
    strict: false,
  }),
);
export async function executeTool(
  name: string,
  args: unknown,
  repo: Repository,
  ctx: {
    owner: string;
    thread: string;
    callId: string;
    context: SearchContext;
  },
): Promise<{ result: any; actions: Action[]; context: SearchContext }> {
  const schema = schemas[name as keyof typeof schemas];
  if (!schema) throw Error("ابزار ناشناخته است.");
  const a: any = schema.parse(args);
  const actions: Action[] = [];
  let result: any;
  let context = { ...ctx.context };
  if (name === "search_products") {
    const filters = { ...a };
    context = { ...context, ...filters };
    result = await repo.search({ ...context, limit: 8 });
    actions.push({ type: "search", filters });
  } else if (name === "compare_products") {
    const products = await repo.compare(a.productIds);
    result = products.map((p) => ({
      ...summary(p),
      specs: p.specs
        ?.slice(0, 35)
        .map((s) => ({ ...s, value: String(s.value).slice(0, 1000) })),
    }));
    actions.push({ type: "compare", products: products.map(summary) });
  } else if (name === "find_sellers") {
    const { productId: selectedProduct, sort: sellerSort, ...filters } = a;
    context = { ...context, ...filters, selectedId: selectedProduct };
    result = await repo.sellers({
      ...context,
      ...a,
      sort: a.sort || "distance",
      limit: 12,
    });
    actions.push(
      {
        type: "search",
        filters: {
          place: context.place,
          radius: context.radius,
          installment: context.installment,
          onlyOpen: context.onlyOpen,
        },
      },
      { type: "select", product: summary(await repo.product(a.productId)) },
    );
  } else if (name === "get_shop_details") result = await repo.shop(a.shopId);
  else if (name === "request_inquiry")
    result = await repo.inquiry(
      ctx.owner,
      ctx.thread,
      a.productId,
      a.offerId,
      ctx.callId,
    );
  else
    result = await repo.alternatives(
      a.productId,
      a.budget ?? context.budget,
      a.excludeShopId,
    );
  return { result, actions, context: contextSchema.parse(context) };
}
