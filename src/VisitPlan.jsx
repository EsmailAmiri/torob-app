import React from "react";
import { Clock3, MapPin, Navigation, Store, ArrowLeft, Info } from "lucide-react";
import { fa, money } from "./catalogue";

export default function VisitPlan({ plan, radius, onSeller, onExpand }) {
  const { nearbyOpen, outsideOpen, unknown, area } = plan;
  const best = nearbyOpen || outsideOpen;
  return (
    <section className="visit-plan" aria-label="راهنمای مراجعه حضوری">
      <div className="visit-plan-heading">
        <span className="visit-plan-icon"><Navigation size={19} /></span>
        <div>
          <strong>برای مراجعه از کجا شروع کنم؟</strong>
          <small>بر اساس موقعیت، آفر ثبت‌شده و ساعت کاری اعلام‌شده</small>
        </div>
      </div>
      {best ? (
        <div className="visit-plan-choice">
          <span className={nearbyOpen ? "visit-plan-status is-near" : "visit-plan-status"}>
            <Clock3 size={13} />
            {nearbyOpen ? "طبق برنامه باز و در محدوده" : "طبق برنامه باز، بیرون از محدوده"}
          </span>
          <strong>{best.shop.name}</strong>
          <p>
            {money(best.price)} <span>·</span> {fa(best.distance.toFixed(1))} کیلومتر فاصله مستقیم
          </p>
          <small>این فروشگاه برای همین محصول آفر دارد؛ قیمت و موجودی امروز تأیید نشده‌اند.</small>
          <div className="visit-plan-actions">
            <button onClick={() => onSeller(best)}>جزئیات و استعلام آزمایشی <ArrowLeft size={14} /></button>
            {!nearbyOpen && best.distance <= 30 ? (
              <button className="secondary" onClick={() => onExpand(best)}>گسترش شعاع تا {fa(Math.ceil(best.distance))} کیلومتر</button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="visit-plan-none"><Info size={15} /> فروشگاهی با ساعت کاری «باز» برای این محصول و شرایط فعلی پیدا نشد.</p>
      )}
      {!nearbyOpen && unknown ? (
        <button className="visit-plan-unknown" onClick={() => onSeller(unknown)}>
          <Store size={16} />
          <span><strong>ساعت کاری {unknown.shop.name} ثبت نشده</strong><small>{fa(unknown.distance.toFixed(1))} کیلومتر دورتر است؛ پیش از مراجعه بررسی کنید.</small></span>
          <ArrowLeft size={14} />
        </button>
      ) : null}
      {!nearbyOpen && area ? (
        <div className="visit-plan-area">
          <MapPin size={17} />
          <div>
            <strong>مسیر بررسی دیگر: {area.title}</strong>
            <p>{fa(area.distance.toFixed(1))} کیلومتر فاصله مستقیم تا مرکز تقریبی این محدوده. فروشگاه، موجودی و ساعت کاری آن در دیتاست تأیید نشده است.</p>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${area.position.join(",")}`} target="_blank" rel="noreferrer">مسیریابی به محدوده <ArrowLeft size={13} /></a>
            <a className="visit-plan-source" href={area.source} target="_blank" rel="noreferrer">منبع معرفی محدوده ↗</a>
          </div>
        </div>
      ) : null}
      <p className="visit-plan-footnote">ساعت کاری از برنامهٔ ثبت‌شده خوانده می‌شود و باز بودن واقعی را تضمین نمی‌کند. فاصله، مسیر خیابانی نیست.</p>
    </section>
  );
}
