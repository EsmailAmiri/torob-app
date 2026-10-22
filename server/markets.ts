import { normalize } from "../src/catalogue.js";

// Approximate area centres, never a claim of inventory or a specific shop entrance.
export const marketAreas = [
  {
    id: "camera",
    title: "محدوده ناصرخسرو؛ فروشندگان دوربین و لوازم عکاسی",
    category: "دوربین",
    position: [35.6805, 51.422] as [number, number],
    keywords: /دوربین|عکاسی|فیلمبرداری|bolex|camera|لنز/,
    source: "https://digi24.ir/shop/",
    sourceLabel: "آدرس منتشرشده دیجی۲۴",
    reason:
      "ناحیه‌ای برای پرس‌وجوی حضوری درباره تجهیزات عکاسی؛ موجودی مدل خاص معلوم نیست.",
  },
  {
    id: "mobile",
    title: "محدوده جمهوری و حافظ؛ بازار چارسو",
    category: "گوشی موبایل",
    position: [35.695, 51.412] as [number, number],
    keywords: /گوشی|موبایل|سامسونگ|هدفون|دیجیتال|لپ تاپ|iphone/,
    source: "https://janebi360.com/contact/",
    sourceLabel: "آدرس منتشرشده جانبی۳۶۰ در چارسو",
    reason:
      "ناحیه فروش کالای دیجیتال؛ برای بررسی حضوری گزینه‌های خارج از پوشش دیتاست.",
  },
  {
    id: "sports",
    title: "محدوده میدان منیریه؛ لوازم و پوشاک ورزشی",
    category: "کفش",
    position: [35.678, 51.399] as [number, number],
    keywords: /کفش|کتونی|کتانی|ورزش|پیاده روی|تردمیل/,
    source: "https://accosport.com/contact",
    sourceLabel: "آدرس شعبه منیریه اکو اسپرت",
    reason:
      "ناحیه‌ای برای بررسی کفش و تجهیزات ورزشی؛ تناسب و موجودی باید حضوری بررسی شود.",
  },
];
export function areasFor(query: string) {
  return marketAreas
    .filter((a) => a.keywords.test(normalize(query)))
    .map(({ keywords, ...area }) => ({
      ...area,
      provenance: "external",
      confidence: "area_only",
      checkedAt: "2026-10-22",
      note: "خارج دیتاست ترب · نقطه تقریبی ناحیه · بدون تأیید موجودی، ساعت یا قیمت",
    }));
}
