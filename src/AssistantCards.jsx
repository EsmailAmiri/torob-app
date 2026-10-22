import React, { useEffect, useRef, useState } from "react";
import { money, dateLabel } from "./catalogue";

function AreaMap({ area }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false,
      map;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
      .then(([module]) => {
        if (disposed || !ref.current) return;
        const L = module.default;
        map = L.map(ref.current, { scrollWheelZoom: false }).setView(
          area.position,
          15,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        })
          .on("tileerror", () => setFailed(true))
          .addTo(map);
        L.circle(area.position, {
          radius: 250,
          color: "#d73948",
          fillOpacity: 0.13,
        }).addTo(map);
        L.circleMarker(area.position, { radius: 7, color: "#d73948" }).addTo(
          map,
        );
        map.invalidateSize();
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [area]);
  return (
    <>
      <div
        className="area-map"
        ref={ref}
        role="img"
        aria-label={"نقشه تقریبی " + area.title}
      />
      {failed ? (
        <small>بارگذاری نقشه کامل نشد؛ لینک مسیریابی در دسترس است.</small>
      ) : null}
    </>
  );
}
export default function AssistantCards({
  actions = [],
  onProduct,
  onSeller,
  onSimulate,
  busyInquiry,
}) {
  // Keep the latest result of each kind instead of duplicating each tool round.
  const latest = Object.fromEntries(
    actions
      .filter((a) =>
        ["results", "sellers", "markets", "inquiry"].includes(a.type),
      )
      .map((a) => [a.type, a]),
  );
  if (!latest.results)
    latest.results = actions.findLast((a) => a.type === "compare");
  return (
    <div className="assistant-cards">
      {latest.results?.products.slice(0, 4).map((p) => (
        <button
          className="assistant-product"
          key={p.id}
          onClick={() => onProduct(p)}
        >
          <strong>{p.title}</strong>
          <span>{money(p.price)}</span>
          <small>قیمت ثبت‌شده · مشاهده فروشندگان حضوری ←</small>
        </button>
      ))}
      {latest.sellers?.offers.slice(0, 3).map((o) => (
        <button
          className="assistant-product"
          key={o.id}
          onClick={() => onSeller(o)}
        >
          <strong>{o.shop.name}</strong>
          <span>{money(o.price)}</span>
          <small>{o.shop.address}</small>
          <small>
            {o.hours?.label} · {o.distance?.toFixed(1)} کیلومتر مستقیم
          </small>
          <small>موجودی تأیید نشده · آدرس و مسیریابی ←</small>
        </button>
      ))}
      {latest.markets?.catalogue.length ? (
        <div className="catalogue-reminder">
          <strong>این گزینه‌ها در دیتاست پیدا شدند</strong>
          {latest.markets.catalogue.slice(0, 4).map((p) => (
            <button key={p.id} onClick={() => onProduct(p)}>
              {p.title} · {money(p.price)}
            </button>
          ))}
        </div>
      ) : null}
      {latest.markets?.areas.map((area) => (
        <section className="area-card" key={area.id}>
          <small>پیشنهاد خارج دیتاست · بدون تأیید موجودی</small>
          <h3>{area.title}</h3>
          <p>{area.reason}</p>
          <AreaMap area={area} />
          <p>نقطه تقریبی ناحیه است؛ محل فروش قطعی این مدل نیست.</p>
          <a href={area.source} target="_blank" rel="noreferrer">
            منبع: {area.sourceLabel}
          </a>
          <a
            className="primary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${area.position.join(",")}`}
            target="_blank"
            rel="noreferrer"
          >
            مسیریابی به ناحیه خرید
          </a>
        </section>
      ))}
      {latest.inquiry ? (
        <section className="inquiry-card">
          <small>استعلام آزمایشی · هیچ تماس واقعی انجام نمی‌شود</small>
          <h3>{latest.inquiry.inquiry.shop?.name}</h3>
          <p>{latest.inquiry.inquiry.productTitle}</p>
          <p>
            قیمت ثبت‌شده:{" "}
            {money(
              latest.inquiry.inquiry.price ??
                latest.inquiry.inquiry.demoResponse?.price,
            )}
          </p>
          <small>
            آخرین تغییر:{" "}
            {dateLabel(
              latest.inquiry.inquiry.changed ||
                latest.inquiry.inquiry.demoResponse?.changed,
            )}
          </small>
          <p role="status">
            {
              {
                not_contacted: "در انتظار انتخاب پاسخ فرضی",
                available_demo: "پاسخ فرضی: موجود است؛ تأیید واقعی نیست",
                unavailable_demo: "پاسخ فرضی: ناموجود؛ جایگزین‌ها بررسی شدند",
                noanswer_demo: "پاسخ فرضی: عدم پاسخ؛ جایگزین‌ها بررسی شدند",
              }[latest.inquiry.inquiry.status]
            }
          </p>
          <div className="simulation-options">
            {[
              ["available_demo", "موجود است"],
              ["unavailable_demo", "ناموجود"],
              ["noanswer_demo", "عدم پاسخ"],
            ].map(([status, label]) => (
              <button
                key={status}
                disabled={!!busyInquiry}
                onClick={() => onSimulate(latest.inquiry.inquiry, status)}
              >
                سناریو: {label}
              </button>
            ))}
          </div>
          <small>
            قیمت و ساعت از دیتاست‌اند و نتیجه انتخاب‌شده صرفاً نمایشی است.
          </small>
        </section>
      ) : null}
    </div>
  );
}
