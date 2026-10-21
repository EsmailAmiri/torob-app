import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    brand: text("brand"),
    price: real("price"),
    count: integer("offer_count").notNull(),
    search: text("search").notNull(),
    summary: text("summary").notNull(),
    detail: text("detail").notNull(),
  },
  (t) => [
    index("products_category").on(t.category),
    index("products_price").on(t.price),
  ],
);
export const shops = sqliteTable("shops", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    state: text("state").notNull(),
    updated: integer("updated").notNull(),
    lockedUntil: integer("locked_until").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const inquiries = sqliteTable(
  "inquiries",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    thread: text("thread").notNull(),
    productId: text("product_id").notNull(),
    offerId: text("offer_id").notNull(),
    status: text("status").notNull(),
    updated: integer("updated").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const imports = sqliteTable("catalogue_imports", {
  id: text("id").primaryKey(),
  count: integer("count").notNull(),
  updated: integer("updated").notNull(),
});
export const limits = sqliteTable("rate_limits", {
  owner: text("owner").primaryKey(),
  window: integer("window").notNull(),
  count: integer("count").notNull(),
});
