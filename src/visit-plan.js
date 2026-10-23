import { distance, hasInPersonCredit, hoursStatus, normalize } from "./catalogue.js";

// These are approximate shopping areas, not shops or claims of current stock.
export const shoppingAreas = [
  { id: "digital", title: "محدوده چارسو و جمهوری", position: [35.695, 51.412], match: /گوشی|موبایل|شارژر|کابل|هدفون|لپ تاپ|دیجیتال|سامسونگ|آیفون|iphone/, source: "https://janebi360.com/contact/" },
  { id: "camera", title: "محدوده ناصرخسرو", position: [35.6805, 51.422], match: /دوربین|عکاسی|لنز|فیلمبرداری/, source: "https://digi24.ir/shop/" },
  { id: "sports", title: "محدوده منیریه", position: [35.678, 51.399], match: /کفش|کتونی|کتانی|ورزش|پیاده روی|تردمیل/, source: "https://accosport.com/contact" },
  { id: "books", title: "محدوده انقلاب", position: [35.70094, 51.39117], match: /کتاب|رمان|درسی|دانشگاهی|نوشت افزار|لوازم التحریر|دفتر|مداد|خودکار/, source: "https://www.isba.ir/Default/TextDetails/contactus" },
  { id: "home-appliances", title: "محدوده سه‌راه امین حضور", position: [35.68385, 51.43684], match: /لوازم خانگی|یخچال|لباسشویی|ماشین ظرفشویی|جاروبرقی|اجاق گاز|کولر|سرخ کن|تلویزیون/, source: "https://aminhozourshop.ir/" },
];

export function visitPlan(offers, { center, radius, budget, installment, onlyOpen, query }, at = new Date()) {
  const eligible = offers.filter((offer) =>
    (!installment || hasInPersonCredit(offer.shop)) &&
    (!budget || (offer.price != null && offer.price <= Number(budget))) &&
    offer.distance != null,
  );
  const byDistance = (a, b) => a.distance - b.distance;
  const open = eligible.filter((offer) => hoursStatus(offer.shop, at).state === "open").sort(byDistance);
  const nearbyOpen = open.find((offer) => offer.distance <= radius);
  const outsideOpen = open.find((offer) => offer.distance > radius);
  const unknown = onlyOpen ? null : eligible
    .filter((offer) => offer.distance <= radius && hoursStatus(offer.shop, at).state === "unknown")
    .sort(byDistance)[0];
  const area = shoppingAreas
    .filter((item) => item.match.test(normalize(query)))
    .map((item) => ({ ...item, distance: distance(center, item.position) }))
    .sort(byDistance)[0] || null;
  return { nearbyOpen, outsideOpen, unknown, area };
}
