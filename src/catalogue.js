export const fa = (n) => new Intl.NumberFormat("fa-IR").format(n);
export const money = (n) => (n == null ? "قیمت نامشخص" : fa(n) + " تومان");
export const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c))
    .replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c))
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const places = {
  "مرکز تهران": [35.7, 51.41],
  ونک: [35.757, 51.409],
  صادقیه: [35.722, 51.331],
  تجریش: [35.804, 51.429],
  جمهوری: [35.695, 51.407],
  ولیعصر: [35.714, 51.407],
  تهرانپارس: [35.734, 51.525],
};
export function distance(a, b) {
  if (!a || !b) return null;
  const rad = (n) => (n * Math.PI) / 180;
  const dlat = rad(b[0] - a[0]),
    dlon = rad(b[1] - a[1]);
  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dlon / 2) ** 2,
      ),
    )
  );
}
export function hoursStatus(shop, at = new Date()) {
  if (!shop.weekly_hours)
    return { label: "ساعت کاری نامشخص", state: "unknown" };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tehran",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const day = parts.weekday.toLowerCase(),
    schedule = shop.weekly_hours[day];
  const now = Number(parts.hour) * 60 + Number(parts.minute);
  const minute = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  // Include previous day's overnight shift.
  const week = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const previous = shop.weekly_hours[week[(week.indexOf(day) + 6) % 7]];
  const overnight =
    previous?.status === "declared" &&
    previous.shifts?.some(
      (s) =>
        minute(s.end_time) < minute(s.start_time) && now < minute(s.end_time),
    );
  if (overnight) return { label: "طبق برنامه باز است", state: "open" };
  if (!schedule || !["declared", "closed"].includes(schedule.status))
    return { label: "ساعت کاری نامشخص", state: "unknown" };
  if (schedule.status === "closed")
    return { label: "طبق برنامه بسته است", state: "closed" };
  const active = (schedule.shifts || []).some((s) => {
    const a = minute(s.start_time),
      b = minute(s.end_time);
    return b > a ? now >= a && now < b : b < a ? now >= a : false;
  });
  return {
    label: active || overnight ? "طبق برنامه باز است" : "طبق برنامه بسته است",
    state: active || overnight ? "open" : "closed",
  };
}
export const shardCache = new Map();
export async function readCompressed(url, options) {
  const r = await fetch(url + ".gz", options);
  if (!r.ok) throw Error("دریافت داده‌ها انجام نشد");
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes[0] === 31 && bytes[1] === 139)
    return new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).json();
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function getProduct(p) {
  const key = p.id.slice(-2);
  if (!shardCache.has(key))
    shardCache.set(
      key,
      readCompressed("/data/products-" + key + ".json").catch((e) => {
        shardCache.delete(key);
        throw e;
      }),
    );
  return (await shardCache.get(key))[p.id];
}
export function dateLabel(date) {
  if (!date) return "زمان ثبت نامشخص";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tehran",
  }).format(new Date(date));
}
export function parseRequest(text) {
  const t = normalize(text),
    result = {};
  const budget = t.match(
    /(?:تا|زیر|حداکثر|بودجه(?: ام)?)[\s:]*([\d.,٬]+)\s*(میلیون|میلیارد|هزار)?/,
  );
  if (budget)
    result.budget =
      Number(budget[1].replace(/[,٬]/g, "")) *
      (budget[2] === "میلیون"
        ? 1e6
        : budget[2] === "میلیارد"
          ? 1e9
          : budget[2] === "هزار"
            ? 1e3
            : 1);
  if (/قسط|اعتبار|ترب پی/.test(t)) result.installment = true;
  if (/نقدی|بدون قسط|همه فروشگاه/.test(t)) result.installment = false;
  if (/ارزان|کمترین قیمت/.test(t)) result.sort = "price";
  if (/نزدیک/.test(t)) result.near = true;
  for (const place of Object.keys(places))
    if (t.includes(normalize(place))) result.place = place;
  const categories = [
    [/لپ ?تاپ|نوت ?بوک/, "لپ تاپ"],
    [/گوشی|موبایل/, "گوشی موبایل"],
    [/هدفون|هندزفری|ایرپاد/, "هدفون"],
    [/کفش|کتونی|کتانی/, "کفش"],
    [/ساعت/, "ساعت"],
    [/دوربین/, "دوربین"],
    [/جارو/, "جاروبرقی"],
  ];
  for (const [regex, query] of categories)
    if (regex.test(t)) {
      result.query = query;
      break;
    }
  if (/سامسونگ/.test(t)) result.brand = "سامسونگ";
  if (/شیائومی/.test(t)) result.brand = "شیائومی";
  if (/آیفون|اپل/.test(t)) result.brand = "اپل";
  return result;
}
