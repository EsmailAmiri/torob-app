import { money, normalize } from "../src/catalogue.js";

export function groundPrices(
  text: string,
  input: any[],
  budget?: number | null,
) {
  const prices = new Set<number>();
  const allowed = new Set<number>(budget ? [budget] : []);
  const walk = (value: any) => {
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (
        typeof v === "number" &&
        /^(price|maxPrice|min_price_toman|max_price_toman)$/.test(key)
      ) {
        prices.add(v);
        allowed.add(v);
      } else if (v && typeof v === "object") walk(v);
    }
  };
  for (const item of input)
    if (item.type === "function_call_output") {
      try {
        walk(JSON.parse(item.output));
      } catch {}
    }
  // Validate displayed monetary claims, including Persian digits and grouped table cells.
  const numeric = "[0-9۰-۹٠-٩]+(?:[٬,،٫.][0-9۰-۹٠-٩]+)*";
  const pattern = new RegExp(
    numeric +
      "(?:\\s*(?:هزار|میلیون|میلیارد))?(?:\\s*و\\s*" +
      numeric +
      "\\s*(?:هزار|میلیون|میلیارد))*(?:\\s*تومان)?",
    "g",
  );
  return text.replace(pattern, (raw, offset) => {
    const n = normalize(raw).replace(/[٬,،]/g, "").replace(/٫/g, ".");
    const amount = Math.round(
      n
        .split(/\s+و\s+/)
        .reduce(
          (sum, part) =>
            sum +
            parseFloat(part) *
              (part.includes("میلیارد")
                ? 1e9
                : part.includes("میلیون")
                  ? 1e6
                  : part.includes("هزار")
                    ? 1e3
                    : 1),
          0,
        ),
    );
    const monetary = /تومان|میلیون|میلیارد/.test(raw);
    const grouped = /[٬,،]/.test(raw) && amount >= 1000;
    if (!monetary && !grouped) return raw;
    if (allowed.has(amount)) return raw;
    const nearby = text.slice(
      Math.max(0, offset - 40),
      offset + raw.length + 40,
    );
    if (/اختلاف|اقتصادی|ارزان‌تر|ارزانتر|گران‌تر/.test(nearby)) {
      for (const a of prices)
        for (const b of prices) {
          const diff = Math.abs(a - b);
          if (
            diff > 0 &&
            (diff === amount ||
              (/حدود/.test(nearby) && Math.abs(diff - amount) < 1e6))
          )
            return money(diff);
        }
    }
    if (prices.has(amount * 10))
      return money(amount * 10).replace(/ تومان$/, monetary ? " تومان" : "");
    if (prices.has(amount / 10))
      return money(amount / 10).replace(/ تومان$/, monetary ? " تومان" : "");
    if(monetary && /حدود|شروع|از/.test(nearby)) {
      const nearest=[...prices].sort((a,b)=>Math.abs(a-amount)-Math.abs(b-amount))[0];
      if(nearest && Math.abs(nearest-amount)<1000000 && Math.abs(nearest-amount)/nearest<.01) return money(nearest);
    }
    // Unknown prices are never presented as facts. The source cards remain authoritative.
    const line = text.slice(
      text.lastIndexOf("\n", offset) + 1,
      text.indexOf("\n", offset) === -1
        ? text.length
        : text.indexOf("\n", offset),
    );
    return monetary ||
      (grouped &&
        (/قیمت|تومان/.test(line) ||
          (line.includes("|") && /قیمت|تومان/.test(text))))
      ? "قیمت ثبت‌شده در کارت نتیجه"
      : raw;
  });
}

export function toolSummary(actions: any[]) {
  const products = actions.flatMap((a) =>
    a.type === "results" || a.type === "compare" ? a.products : [],
  );
  const offers = actions.flatMap((a) => (a.type === "sellers" ? a.offers : []));
  const lines = ["بررسی انجام شد؛ جمع‌بندی بر اساس داده‌های ثبت‌شده:"];
  for (const p of [...new Map(products.map((p) => [p.id, p])).values()].slice(
    0,
    4,
  ))
    lines.push(`${p.title}: ${money(p.price)}`);
  for (const o of offers.slice(0, 3))
    lines.push(
      `${o.shop.name}: ${money(o.price)}؛ ${o.shop.address || "آدرس نامشخص"}`,
    );
  if (!products.length && !offers.length)
    lines.push(
      "با شرایط فعلی گزینه قطعی پیدا نشد؛ بودجه، مدل یا محدوده را تغییر بده.",
    );
  if (actions.some((a) => a.type === "markets"))
    lines.push(
      "کارت ناحیه خرید نمایش داده شد؛ این پیشنهاد خارج دیتاست و بدون تأیید موجودی است.",
    );
  lines.push("قیمت‌ها تاریخی‌اند؛ موجودی تأیید نشده است.");
  return lines.join("\n\n");
}

export function groundMissingMarket(text: string, actions: any[], query: string) {
  const market = actions.findLast((action) => action.type === "markets");
  if (!market || market.catalogue?.length || !market.areas?.length) return text;
  const names = market.areas.map((area: any) => `«${area.title}»`).join("، ");
  const related = actions.some((action) => action.type === "results" && action.products?.length);
  return `برای «${query}» محصول مطابق در دیتاست پیدا نشد. برای پرس‌وجوی حضوری می‌توانید ${names} را بررسی کنید. نقشه و منبع هر محدوده در کارت زیر آمده است. این پیشنهاد خارج از دیتاست است و موجودی مدل، ساعت کاری و قیمت آن تأیید نشده‌اند.${related ? " چند محصول هم‌دستهٔ دیتاست نیز در کارت‌های جدا نمایش داده شده‌اند؛ آن‌ها همان مدل درخواستی نیستند." : ""}`;
}
