import { z } from "zod";
import { places, money, inferCategory } from "../src/catalogue.js";
import { areasFor } from "./markets";
import { Repository, productId, shopId, searchSchema } from "./repository";
import type { Action, SearchContext } from "./types";
const place = z.enum(Object.keys(places) as [string, ...string[]]);
const positionInput = z
  .object({
    lat: z.number().min(35.4).max(35.95),
    lon: z.number().min(51).max(51.8),
  })
  .nullable();
export const contextSchema = z.object({
  query: z.string().max(160).default("گوشی موبایل"),
  category: z.string().max(160).default(""),
  position: z
    .tuple([z.number().min(35.4).max(35.95), z.number().min(51).max(51.8)])
    .nullable()
    .default(null),
  excludedShopIds: z.array(shopId).max(30).default([]),
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
    position: positionInput.optional(),
    place: place.optional(),
    radius: z.number().min(1).max(30).optional(),
    installment: z.boolean().optional(),
    onlyOpen: z.boolean().optional(),
  }),
  compare_products: z.object({ productIds: z.array(productId).min(2).max(3) }),
  find_sellers: z.object({
    position: positionInput.optional(),
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
  suggest_market_areas: z.object({ query: z.string().min(1).max(160) }),
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
  suggest_market_areas:
    "After searching the catalogue, suggest sourced Tehran shopping areas for a missing item, with map widgets. Always rechecks the dataset without budget before showing external suggestions. Pass the actual requested model/category, not a generic word.",
};
const summary = (p: any) => {
  const { offers, specs, ...rest } = p;
  return {
    ...rest,
    priceLabel: money(p.price),
    maxPriceLabel: money(p.maxPrice),
    currency: "تومان",
  };
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
  if (a.position) a.position = [a.position.lat, a.position.lon];
  const actions: Action[] = [];
  let result: any;
  let context = { ...ctx.context };
  if (name === "search_products") {
    const filters = { ...a };
    if (a.query !== undefined && a.category === undefined)
      filters.category = inferCategory(a.query);
    context = { ...context, ...filters };
    if (a.place && a.position === undefined) context.position = null;
    result = await repo.search({ ...context, limit: 8 });
    actions.push({ type: "search", filters });
    actions.push({ type: "results", products: result.products });
    result.products = result.products.map(summary);
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
    if (a.place && a.position === undefined) context.position = null;
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
          position: context.position,
        },
      },
      { type: "select", product: summary(await repo.product(a.productId)) },
      { type: "sellers", offers: result.offers },
    );
  } else if (name === "get_shop_details") result = await repo.shop(a.shopId);
  else if (name === "request_inquiry") {
    result = await repo.inquiry(
      ctx.owner,
      ctx.thread,
      a.productId,
      a.offerId,
      ctx.callId,
    );
    const product = await repo.product(a.productId);
    const offer = product.offers?.find((o) => o.id === a.offerId);
    result = {
      ...result,
      productTitle: product.title,
      shop: await repo.shop(offer.shop),
      price: offer.price,
      priceLabel: money(offer.price),
      changed: offer.changed,
    };
    actions.push({ type: "inquiry", inquiry: result });
  } else if (name === "suggest_market_areas") {
    const catalogue = await repo.search({ query: a.query, limit: 8 });
    const areas = areasFor(a.query);
    const related = catalogue.total
      ? null
      : await repo.search({
          query: "",
          category: areas[0]?.category || inferCategory(a.query) || a.query,
          limit: 4,
        });
    result = {
      catalogue,
      related,
      areas,
      note: "نتایج دیتاست مقدم‌اند. گزینه‌های مشابه مدل درخواستی نیستند. ناحیه بیرونی نشانه موجودی محصول نیست.",
    };
    actions.push({ type: "markets", areas, catalogue: catalogue.products });
    if (related?.products.length)
      actions.push({ type: "results", products: related.products });
  } else {
    result = await repo.alternatives(
      a.productId,
      a.budget ?? context.budget,
      a.excludeShopId,
      context,
    );
    actions.push(
      { type: "results", products: result.products },
      { type: "sellers", offers: result.sameProductSellers },
    );
  }
  if (result?.offers)
    result.offers = result.offers.map((o: any) => ({
      ...o,
      priceLabel: money(o.price),
      currency: "تومان",
    }));
  return { result, actions, context: contextSchema.parse(context) };
}
