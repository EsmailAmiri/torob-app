let catalogue, loading;
async function decode(r) {
  if (!r.ok) throw Error();
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes[0] === 31 && bytes[1] === 139)
    return new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).json();
  return JSON.parse(new TextDecoder().decode(bytes));
}
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c))
    .replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c))
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
onmessage = async ({ data }) => {
  const { id, query, budget, brand, sort } = data;
  try {
    if (!loading)
      loading = fetch("/data/search.json.gz")
        .then(decode)
        .then((rows) => {
          catalogue = rows;
          for (const p of catalogue)
            p.normalized = norm(
              p.title + " " + p.category + " " + (p.brand || ""),
            );
        })
        .catch((e) => {
          loading = null;
          throw e;
        });
    await loading;
    const q = norm(query),
      words = q.split(" ").filter(Boolean),
      b = norm(brand);
    let matches = [];
    for (const p of catalogue) {
      if (budget && (p.price == null || p.price > budget)) continue;
      if (b && !p.normalized.includes(b)) continue;
      if (words.every((w) => p.normalized.includes(w))) {
        let rank =
          (p.category === query ? 20 : 0) +
          (p.normalized.startsWith(q) ? 5 : 0) +
          Math.min(p.count, 20) +
          (p.image ? 2 : 0) +
          (p.price ? 3 : 0);
        matches.push({ p, rank });
      }
    }
    matches.sort(
      sort === "price"
        ? (a, b) => (a.p.price ?? Infinity) - (b.p.price ?? Infinity)
        : (a, b) => b.rank - a.rank,
    );
    postMessage({
      id,
      total: matches.length,
      products: matches.slice(0, 120).map(({ p: { normalized, ...p } }) => p),
    });
  } catch (e) {
    console.error("Catalogue search failed", e);
    postMessage({
      id,
      error:
        "دریافت کاتالوگ انجام نشد. اتصال اینترنت را بررسی و دوباره جست‌وجو کنید.",
    });
  }
};
