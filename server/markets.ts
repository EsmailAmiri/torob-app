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
  {
    id: "books",
    title: "محدوده میدان و خیابان انقلاب؛ کتاب و نوشت‌افزار",
    category: "کتاب",
    position: [35.70094, 51.39117] as [number, number],
    keywords: /کتاب|رمان|درسی|دانشگاهی|نوشت افزار|لوازم التحریر|دفتر|مداد|خودکار/,
    source: "https://www.isba.ir/Default/TextDetails/contactus",
    sourceLabel: "نشانی فروشگاه کتاب جهاد دانشگاهی",
    reason:
      "نشانی منتشرشده یک کتاب‌فروشی در خیابان انقلاب، سرنخ بررسی حضوری این محدوده است؛ موجودی عنوان مشخص معلوم نیست.",
  },
  {
    id: "home-appliances",
    title: "محدوده سه‌راه امین حضور؛ لوازم خانگی",
    category: "لوازم خانگی",
    position: [35.68385, 51.43684] as [number, number],
    keywords: /لوازم خانگی|یخچال|لباسشویی|ماشین ظرفشویی|جاروبرقی|اجاق گاز|کولر|سرخ کن|تلویزیون/,
    source: "https://aminhozourshop.ir/",
    sourceLabel: "نشانی منتشرشده فروشگاه امین حضور",
    reason:
      "نشانی منتشرشده یک فروشگاه لوازم خانگی در سه‌راه امین حضور، سرنخ بررسی حضوری این محدوده است؛ موجودی مدل مشخص معلوم نیست.",
  },
];
export function areasFor(query: string) {
  return marketAreas
    .filter((a) => a.keywords.test(normalize(query)))
    .map(({ keywords, ...area }) => ({
      ...area,
      provenance: "external",
      confidence: "area_only",
      checkedAt: "2026-10-23",
      note: "خارج دیتاست ترب · نقطه تقریبی ناحیه · بدون تأیید موجودی، ساعت یا قیمت",
    }));
}
