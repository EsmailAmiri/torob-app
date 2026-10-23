import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useDeferredValue,
} from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AssistantCards from "./AssistantCards";
import VisitPlan from "./VisitPlan";
import { visitPlan } from "./visit-plan";
import { addressGuide } from "./address-guide";
import shopLinks from "./shop-links.json";
import {
  Search,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ArrowLeft,
  ArrowUp,
  Plus,
  X,
  SlidersHorizontal,
  Sparkles,
  MessageCircle,
  Map as MapIcon,
  List,
  Check,
  CheckCheck,
  Clock,
  Navigation,
  Store,
  Heart,
  Scale,
  Smartphone,
  Laptop,
  Headphones,
  Watch,
  Camera,
  ShoppingBag,
  ShieldCheck,
  Info,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Menu,
  LocateFixed,
  ArrowUpRight,
  Send,
  CheckCircle2,
  Footprints,
  Wallet,
  Home as HomeIcon,
  Trash2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import {
  fa,
  money,
  places,
  distance,
  hoursStatus,
  getProduct,
  dateLabel,
  parseRequest,
  normalize,
  readCompressed,
  hasInPersonCredit,
  inferCategory,
} from "./catalogue";
import "./style.css";
import { api, setBackendReady, threadId, newThread } from "./api";
import { useTheme } from "./theme";
import "./dark.css";
import "./assistant-cards.css";

const categories = [
  { name: "گوشی موبایل", icon: Smartphone },
  { name: "لپ تاپ", icon: Laptop },
  { name: "هدفون", icon: Headphones },
  { name: "ساعت هوشمند", icon: Watch },
  { name: "دوربین", icon: Camera },
  { name: "کفش", icon: Footprints },
];
const initialMessage = {
  role: "assistant",
  text: "سلام! من همراه خریدت هستم. بگو چی می‌خوای و چه بودجه‌ای داری؛ با هم محصول مناسب و فروشگاه‌های نزدیک رو پیدا می‌کنیم.",
};
function Logo({ large = false, onClick }) {
  return (
    <button
      className={"logo " + (large ? "large" : "")}
      onClick={onClick}
      aria-label="صفحه اصلی ترب"
    >
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <g fill="none">
          <path
            fill="#ef193b"
            d="M79.245 20.322l-.627.726c-2.474 2.656-5.814 4.2-9.462 4.313-.16.023-.342.023-.502.023-.456 0-.878-.023-1.31-.068 8.595 10.1 9.895 24.968 2.222 36.579-7.638 11.542-21.774 16.252-34.428 12.484h-.08c-5.13-1.34-10.944.68-14.022 5.414 3.192-4.847 2.736-11.055-.798-15.322v-.045c-8.333-10.079-9.473-24.72-1.87-36.16C26.692 15.67 42.766 11.22 56.195 17.031c-.57-1.476-.935-3.065-1.026-4.688-.114-2.95.741-5.788 2.371-8.171-18.012-5.902-38.532.567-49.476 17.137C-5.104 41.171.425 67.842 20.261 80.893c19.882 13.064 46.592 7.502 59.702-12.246 10.032-15.174 9.177-34.331-.707-48.348z"
          />
          <path
            fill="#bc0b2b"
            d="M31.969 10.22c-10.91 1.08-20.463 5.721-24.054 11.191C-5.195 41.216.3 67.853 20.193 80.905l.73-1.112c3.191-4.847 2.735-11.055-.799-15.322v-.045c-8.22-10.079-9.36-24.72-1.835-36.16C26.61 15.67 42.685 11.22 56.114 17.031c0 0-11.4-8.059-24.122-6.81z"
          />
          <path
            fill="#70b929"
            d="M62.544 22.32s-.342-4.086 1.482-7.037c1.824-2.951 5.7-5.845 10.602-5.539 4.925.307 5.723 1.442 5.723 1.442s.114 3.972-1.254 6.242-4.218 5.606-8.322 6.446c-4.104.829-8.231-1.555-8.231-1.555z"
          />
          <path
            fill="#4d9f20"
            d="M61.062 21.173s-.456-3.972 2.28-7.944c2.736-3.973 5.7-4.563 5.7-4.563S68.7 3.218 66.078.608c.228-.057-3.124.08-6.042 3.291-2.577 2.815-4.104 7.264-2.964 11.577 1.14 4.312 3.99 5.697 3.99 5.697z"
          />
        </g>
      </svg>
      <span>ترب</span>
    </button>
  );
}
function ProductImage({ p, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [p.id]);
  return failed || !p.image ? (
    <div className="image-placeholder">
      <ShoppingBag size={42} />
      <span>تصویر موجود نیست</span>
    </div>
  ) : (
    <img
      src={p.image}
      alt={p.title}
      loading="lazy"
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const all = ref.current?.querySelectorAll(
          'button,a[href],input,select,textarea,[tabindex="0"]',
        );
        if (!all?.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="بستن">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function MapView({ offers, center, onSelect, onSetCenter }) {
  const container = useRef(null),
    map = useRef(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let current;
    let resizeTimer;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
      .then(([module]) => {
        if (disposed || !container.current) return;
        const L = module.default;
        current = L.map(container.current, { zoomControl: false }).setView(
          center,
          12,
        );
        current.on("click", (event) => {
          const { lat, lng } = event.latlng;
          if (lat >= 35.4 && lat <= 35.95 && lng >= 51 && lng <= 51.8)
            onSetCenter([lat, lng]);
        });
        map.current = current;
        L.control.zoom({ position: "bottomleft" }).addTo(current);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
          .on("tileerror", () => setError(true))
          .addTo(current);
        const points = [];
        for (const o of offers) {
          if (!Number.isFinite(o.shop.lat) || !Number.isFinite(o.shop.lon))
            continue;
          const point = [o.shop.lat, o.shop.lon];
          points.push(point);
          const marker = L.marker(point, {
            icon: L.divIcon({
              className: "price-marker",
              html: `<span>${o.price ? fa(o.price) : "فروشگاه"}</span>`,
              iconSize: [105, 32],
              iconAnchor: [52, 32],
            }),
          }).addTo(current);
          marker.on("click", () => onSelect(o));
        }
        L.circleMarker(center, {
          radius: 8,
          fillColor: "#3973de",
          fillOpacity: 1,
          color: "#fff",
          weight: 3,
        })
          .addTo(current)
          .bindTooltip("محدوده انتخابی");
        if (points.length)
          current.fitBounds(L.latLngBounds([...points, center]), {
            padding: [50, 60],
            maxZoom: 14,
            animate: false,
          });
        resizeTimer = setTimeout(() => {
          if (!disposed) current?.invalidateSize({ animate: false });
        }, 100);
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      current?.stop();
      current?.remove();
      map.current = null;
    };
  }, [offers, center, onSelect, onSetCenter]);
  return (
    <div className="map-shell">
      <div className="map-container" ref={container} />
      <span className="map-legend">
        <span className="blue-dot" /> محدوده انتخابی{" "}
        <span className="red-dot" /> فروشگاه‌های دارای آفر
      </span>
      <span className="map-instruction">برای تغییر مبدأ خرید، روی نقشه بزنید.</span>
      {error ? (
        <span className="map-error">
          نقشه به اینترنت نیاز دارد؛ آدرس فروشگاه‌ها در فهرست در دسترس است.
        </span>
      ) : null}
    </div>
  );
}

function App() {
  const { theme, resolved, setTheme, toggleTheme } = useTheme();
  const [backendInfo, setBackendInfo] = useState(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [failedRequest, setFailedRequest] = useState(null);
  const conversation = useRef(threadId());
  const chatGeneration = useRef(0);
  const chatController = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    api("/health", { signal: controller.signal })
      .then((info) => {
        setBackendInfo(info);
        setBackendReady(info.catalogueReady);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setBackendInfo({ ok: false, assistant: { provider: "offline" } });
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!backendInfo?.ok) return;
    let active = true;
    const generation = chatGeneration.current;
    api("/chat/" + conversation.current)
      .then((data) => {
        if (!active || generation !== chatGeneration.current) return;
        if (data.messages?.length)
          setMessages([initialMessage, ...data.messages]);
        const c = data.context;
        if (c && new URLSearchParams(location.search).get("q") === c.query) {
          setBudget(c.budget == null ? "" : String(c.budget));
          setBrand(c.brand);
          if (places[c.place]) setPlace(c.place);
          setRadius(c.radius);
          setInstallment(c.installment);
          setOnlyOpen(c.onlyOpen);
          setSort(c.sort);
          setCategory(c.category || "");
          setCustomPosition(c.position || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [backendInfo?.ok]);
  useEffect(() => () => chatController.current?.abort(), []);

  const [page, setPage] = useState(
    new URLSearchParams(location.search).has("q") ? "results" : "home",
  );
  const [query, setQuery] = useState(
    new URLSearchParams(location.search).get("q") || "گوشی موبایل",
  );
  const [searchText, setSearchText] = useState("");
  const [category, setCategory] = useState("");
  const [busyInquiry, setBusyInquiry] = useState(null);
  const [featured, setFeatured] = useState([]),
    [products, setProducts] = useState([]),
    [total, setTotal] = useState(0),
    [shops, setShops] = useState(null),
    [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [budget, setBudget] = useState(""),
    [brand, setBrand] = useState(""),
    [sort, setSort] = useState("recommended");
  const [place, setPlace] = useState("مرکز تهران"),
    [customPosition, setCustomPosition] = useState(null),
    [installment, setInstallment] = useState(false),
    [radius, setRadius] = useState(30),
    [onlyOpen, setOnlyOpen] = useState(false);
  const [mode, setMode] = useState("inperson"),
    [view, setView] = useState("products"),
    [selected, setSelected] = useState(null),
    [detail, setDetail] = useState(null),
    [detailLoading, setDetailLoading] = useState(false);
  const [compare, setCompare] = useState([]),
    [compareOpen, setCompareOpen] = useState(false),
    [compareDetails, setCompareDetails] = useState([]);
  const [saved, setSaved] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("torob:saved:v1") || "[]");
      } catch {
        return [];
      }
    }),
    [showSaved, setShowSaved] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false),
    [messages, setMessages] = useState([initialMessage]),
    [chatText, setChatText] = useState("");
  const [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(false),
    [shopFocus, setShopFocus] = useState(null),
    [simulations, setSimulations] = useState({});
  const worker = useRef(null),
    requestId = useRef(0),
    chatEnd = useRef(null);
  const deferredQuery = useDeferredValue(query);
  const center = customPosition || places[place];
  const notify = (text) => setToast(text);
  useEffect(() => {
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/featured.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
      fetch("/data/meta.json").then((r) => r.json()),
    ])
      .then(([f, m]) => {
        if (cancelled) return;
        setFeatured(f);
        setMeta(m);
      })
      .catch(() =>
        setError("دریافت داده‌ها انجام نشد. صفحه را دوباره بارگذاری کنید."),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (page !== "results") return;
    const controller = new AbortController();
    readCompressed("/data/shops.json", { signal: controller.signal })
      .then(setShops)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "اطلاعات فروشگاه‌ها دریافت نشد. صفحه را دوباره بارگذاری کنید.",
          );
      });
    return () => controller.abort();
  }, [page]);
  useEffect(() => {
    if (page !== "results" || backendInfo === null) return;
    setLoading(true);
    setError("");
    if (backendInfo?.catalogueReady) {
      const controller = new AbortController();
      const current = ++requestId.current;
      const params = new URLSearchParams({
        query: deferredQuery,
        brand,
        sort,
        limit: "60",
        category,
      });
      if (Number(budget) > 0) params.set("budget", budget);
      api("/products?" + params, { signal: controller.signal })
        .then((data) => {
          if (current === requestId.current) {
            setProducts(data.products);
            setTotal(data.total);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (e.name !== "AbortError" && current === requestId.current) {
            setError(e.message);
            setLoading(false);
          }
        });
      return () => controller.abort();
    }
    if (!worker.current) {
      worker.current = new Worker("/search-worker.js");
      worker.current.onmessage = ({ data }) => {
        if (data.id !== requestId.current) return;
        setLoading(false);
        if (data.error) {
          setError(data.error);
          return;
        }
        setProducts(data.products);
        setTotal(data.total);
      };
      worker.current.onerror = () => {
        setLoading(false);
        setError("جست‌وجو با خطا مواجه شد؛ صفحه را دوباره بارگذاری کنید.");
      };
    }
    worker.current.postMessage({
      id: ++requestId.current,
      query: deferredQuery,
      budget: Number(budget) || null,
      brand,
      sort,
      category,
    });
  }, [page, deferredQuery, budget, brand, sort, category, backendInfo]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, assistantOpen]);
  useEffect(() => {
    localStorage.setItem("torob:saved:v1", JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setDetail(null);
    getProduct(selected)
      .then((p) => {
        if (alive) setDetail(p);
      })
      .catch(() => notify("دریافت جزئیات انجام نشد. دوباره تلاش کنید."))
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected]);
  useEffect(() => {
    if (!compareOpen) return;
    let alive = true;
    setCompareDetails([]);
    Promise.all(compare.map(getProduct))
      .then((p) => {
        if (alive) setCompareDetails(p);
      })
      .catch(() => notify("دریافت مشخصات مقایسه انجام نشد."));
    return () => {
      alive = false;
    };
  }, [compareOpen, compare]);
  useEffect(() => {
    const handle = () => {
      const q = new URLSearchParams(location.search).get("q");
      setPage(q ? "results" : "home");
      if (q) setQuery(q);
    };
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, []);
  function goSearch(text) {
    const q = (text || searchText || "گوشی موبایل").trim();
    setQuery(q);
    setCategory(inferCategory(q));
    setSearchText(q);
    setPage("results");
    setShowSaved(false);
    setSelected(null);
    setView("products");
    history.pushState({}, "", `?q=${encodeURIComponent(q)}`);
    window.scrollTo({ top: 0 });
  }
  function goHome() {
    setPage("home");
    history.pushState({}, "", "/");
    setSelected(null);
    setShowSaved(false);
    setSearchText("");
  }
  function toggleSave(p) {
    setSaved((old) =>
      old.some((x) => x.id === p.id)
        ? old.filter((x) => x.id !== p.id)
        : [...old, p],
    );
  }
  function toggleCompare(p) {
    setCompare((old) => {
      if (old.some((x) => x.id === p.id))
        return old.filter((x) => x.id !== p.id);
      if (old.length >= 3) {
        notify("برای مقایسه، حداکثر سه محصول انتخاب کنید.");
        return old;
      }
      return [...old, p];
    });
  }
  function resetFilters() {
    setBudget("");
    setBrand("");
    setInstallment(false);
    setOnlyOpen(false);
    setRadius(30);
    setSort("recommended");
  }
  function locate() {
    if (!navigator.geolocation) {
      notify("موقعیت‌یابی پشتیبانی نمی‌شود. محدوده را دستی انتخاب کنید.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = [p.coords.latitude, p.coords.longitude];
        if (distance(pos, places["مرکز تهران"]) > 70) {
          notify(
            "دیتاست فقط فروشگاه‌های تهران را پوشش می‌دهد. یک محدوده در تهران انتخاب کنید.",
          );
          return;
        }
        setCustomPosition(pos);
        setModal(null);
        notify("موقعیت شما برای محاسبه فاصله تنظیم شد.");
      },
      () => notify("دسترسی به موقعیت انجام نشد؛ محدوده را دستی انتخاب کنید."),
      { timeout: 10000 },
    );
  }
  function pageContext() {
    return {
      query,
      category,
      position: customPosition,
      budget: Number(budget) > 0 ? Number(budget) : null,
      brand,
      place,
      radius: Number(radius),
      installment,
      onlyOpen,
      sort,
      selectedId: selected?.id || null,
      compareIds: compare.map((p) => p.id),
    };
  }
  async function sendChat(text, retryRequest) {
    const input = (text || chatText).trim();
    if ((!input && !retryRequest) || chatBusy) return;
    const request = retryRequest || {
      threadId: conversation.current,
      requestId: crypto.randomUUID(),
      message: input,
      context: {
        query,
        category,
        position: customPosition,
        budget: Number(budget) > 0 ? Number(budget) : null,
        brand,
        place,
        radius: Number(radius),
        installment,
        onlyOpen,
        sort,
        selectedId: selected?.id || null,
        compareIds: compare.map((p) => p.id),
      },
    };
    const generation = chatGeneration.current;
    setChatText("");
    setAssistantOpen(true);
    setChatBusy(true);
    setFailedRequest(null);
    if (!retryRequest)
      setMessages((old) => [...old, { role: "user", text: input }]);
    chatController.current = new AbortController();
    try {
      const reply = await api("/chat", {
        method: "POST",
        body: JSON.stringify(request),
        signal: chatController.current.signal,
      });
      if (generation !== chatGeneration.current) return;
      for (const action of reply.actions || []) {
        if (action.type === "search") {
          const f = action.filters || {};
          if (f.query !== undefined) goSearch(f.query);
          if (f.budget !== undefined)
            setBudget(f.budget == null ? "" : String(f.budget));
          if (f.brand !== undefined) setBrand(f.brand);
          if (f.category !== undefined) setCategory(f.category);
          if (f.place && places[f.place]) {
            setPlace(f.place);
            setCustomPosition(null);
          }
          if (f.radius !== undefined) setRadius(f.radius);
          if (f.position !== undefined) setCustomPosition(f.position);
          if (f.installment !== undefined) setInstallment(f.installment);
          if (f.onlyOpen !== undefined) setOnlyOpen(f.onlyOpen);
          if (f.sort) setSort(f.sort);
        } else if (action.type === "select" && action.product?.id) {
          setSelected(action.product);
          setView("products");
        } else if (action.type === "compare" && action.products?.length >= 2) {
          setCompare(action.products.slice(0, 3));
          setCompareOpen(true);
        }
      }
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: reply.text,
          provider: reply.provider,
          tools: reply.tools,
          actions: reply.actions,
        },
      ]);
    } catch (e) {
      if (e.name !== "AbortError" && generation === chatGeneration.current)
        setFailedRequest({ request, error: e.message });
    } finally {
      if (generation === chatGeneration.current) setChatBusy(false);
    }
  }
  function resetConversation() {
    chatGeneration.current++;
    chatController.current?.abort();
    conversation.current = newThread();
    setChatBusy(false);
    setFailedRequest(null);
    setMessages([initialMessage]);
  }
  const offerRows = useMemo(() => {
    if (!detail || !shops) return [];
    return detail.offers
      .map((o) => ({
        ...o,
        shop: shops[o.shop],
        distance: shops[o.shop]
          ? distance(center, [shops[o.shop].lat, shops[o.shop].lon])
          : null,
      }))
      .filter((o) => o.shop)
      .sort((a, b) => a.distance - b.distance);
  }, [detail, shops, center]);
  const visibleOffers = useMemo(
    () =>
      offerRows.filter(
        (o) =>
          (!installment || hasInPersonCredit(o.shop)) &&
          (!budget || (o.price != null && o.price <= Number(budget))) &&
          (!onlyOpen || hoursStatus(o.shop).state === "open") &&
          (o.distance === null || o.distance <= Number(radius)),
      ),
    [offerRows, installment, onlyOpen, radius, budget],
  );
  const plan = useMemo(
    () => visitPlan(offerRows, { center, radius: Number(radius), budget, installment, onlyOpen, query: query + " " + (detail?.title || "") }),
    [offerRows, center, radius, budget, installment, onlyOpen, detail?.title, query],
  );
  const displayProducts = showSaved
    ? saved
    : loading
      ? featured.length
        ? featured
        : []
      : products;
  const mapSelect = React.useCallback((o) => setShopFocus(o), []);
  const mapSetCenter = React.useCallback((position) => {
    setCustomPosition(position);
    setPlace("مرکز تهران");
  }, []);
  const activeFilters = [
    budget && `تا ${money(Number(budget))}`,
    brand,
    installment && "اقساط حضوری اعلام‌شده",
    onlyOpen && "طبق برنامه باز",
    radius < 30 && `تا ${fa(radius)} کیلومتر`,
  ].filter(Boolean);
  async function runSimulation(inquiry, status) {
    if (busyInquiry || chatBusy) return;
    setBusyInquiry(inquiry.id);
    try {
      const result = await api("/inquiries/" + inquiry.id + "/simulate", {
        method: "POST",
        body: JSON.stringify({ status, context: pageContext() }),
      });
      setSimulations((old) => ({
        ...old,
        [inquiry.offerId]: status.replace("_demo", ""),
      }));
      setMessages((old) => [
        ...old,
        { role: "assistant", text: result.message, actions: result.actions },
      ]);
      setAssistantOpen(true);
      setShopFocus(null);
      setModal(null);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusyInquiry(null);
    }
  }
  async function simulate(o, status) {
    if (!selected || busyInquiry || chatBusy) return;
    setBusyInquiry(o.id);
    try {
      const inquiry = await api("/inquiries", {
        method: "POST",
        body: JSON.stringify({
          threadId: conversation.current,
          requestId: crypto.randomUUID(),
          productId: selected.id,
          offerId: o.id,
        }),
      });
      const result = await api("/inquiries/" + inquiry.id + "/simulate", {
        method: "POST",
        body: JSON.stringify({
          status: status + "_demo",
          context: pageContext(),
        }),
      });
      setSimulations((old) => ({ ...old, [o.id]: status }));
      setMessages((old) => [
        ...old,
        { role: "assistant", text: result.message, actions: result.actions },
      ]);
      setAssistantOpen(true);
      setShopFocus(null);
      setModal(null);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusyInquiry(null);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        رفتن به محتوای اصلی
      </a>
      <header
        className={"site-header " + (page === "home" ? "home-header" : "")}
      >
        <div className="header-main">
          {page !== "home" ? <Logo onClick={goHome} /> : null}
          {page !== "home" ? (
            <form
              className="header-search"
              onSubmit={(e) => {
                e.preventDefault();
                goSearch();
              }}
            >
              <Search size={21} />
              <input
                aria-label="جست‌وجوی محصول"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={query}
              />
              {searchText ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSearchText("")}
                  aria-label="پاک کردن جست‌وجو"
                >
                  <X size={16} />
                </button>
              ) : null}
              <button className="search-submit">جست‌وجو</button>
            </form>
          ) : (
            <nav className="home-top-nav">
              <button onClick={() => goSearch("گوشی موبایل")}>
                موبایل و کالای دیجیتال
              </button>
              <button onClick={() => goSearch("لپ تاپ")}>
                لپ‌تاپ، کامپیوتر، اداری
              </button>
              <button onClick={() => goSearch("مواد غذایی")}>
                هایپر مارکت
              </button>
              <button onClick={() => goSearch("جاروبرقی")}>لوازم خانگی</button>
              <button onClick={() => setModal("categories")}>
                سایر دسته‌ها <ChevronDown size={13} />
              </button>
            </nav>
          )}
          <div className="header-actions">
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={
                resolved === "dark" ? "فعال کردن تم روشن" : "فعال کردن تم تاریک"
              }
              aria-pressed={resolved === "dark"}
              title={resolved === "dark" ? "تم روشن" : "تم تاریک"}
            >
              {resolved === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="location-button"
              onClick={() => setModal("location")}
            >
              <MapPin size={17} />
              <span>
                {customPosition
                  ? "موقعیت من"
                  : place === "مرکز تهران"
                    ? "تهران"
                    : place}
              </span>
              <ChevronDown size={13} />
            </button>
            <button
              className="icon-button saved-header"
              onClick={() => {
                setPage("results");
                setShowSaved(true);
              }}
              aria-label="محصولات ذخیره‌شده"
            >
              <Heart size={20} />
              {saved.length ? <i>{fa(saved.length)}</i> : null}
            </button>
            <span className="header-divider" />
            <button className="login-button" onClick={() => setModal("about")}>
              <span>درباره این نسخه</span>
              <Info size={16} />
            </button>
          </div>
        </div>
        {page !== "home" ? (
          <nav className="category-nav">
            <button onClick={() => setModal("categories")}>
              <Menu size={17} /> دسته‌بندی کالاها <ChevronDown size={13} />
            </button>
            <span />
            {["گوشی موبایل", "لپ تاپ", "لوازم خانگی", "کفش", "هدفون"].map(
              (x) => (
                <button
                  key={x}
                  onClick={() => {
                    resetFilters();
                    goSearch(x);
                  }}
                >
                  {x}
                </button>
              ),
            )}
            <button
              className="nav-hamrah"
              onClick={() => setAssistantOpen(!assistantOpen)}
            >
              <Sparkles size={16} /> ترب همراه <small>جدید</small>
            </button>
          </nav>
        ) : null}
      </header>
      {page === "home" ? (
        <main id="main" className="home-page">
          <div className="home-center">
            <Logo large onClick={goHome} />
            <form
              className="home-search"
              onSubmit={(e) => {
                e.preventDefault();
                goSearch();
              }}
            >
              <Search />
              <input
                autoComplete="off"
                aria-label="نام کالا یا فروشگاه"
                placeholder="نام کالا یا فروشگاه"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button type="submit" aria-label="جست‌وجو">
                <ArrowLeft size={21} />
              </button>
            </form>
            <p className="home-tagline">
              مقایسه قیمت میلیون‌ها محصول بین هزاران فروشگاه
            </p>
            <button
              className="home-companion"
              onClick={() => {
                goSearch("گوشی موبایل");
                setAssistantOpen(true);
              }}
            >
              <span className="companion-symbol">
                <Sparkles size={24} />
              </span>
              <span>
                <strong>خرید خوب، همین نزدیکی.</strong>
                <small>با ترب همراه، برای خرید حضوری تنها نیستی</small>
              </span>
              <span className="new-badge">جدید</span>
              <ArrowLeft size={20} />
            </button>
            <div className="home-suggestions">
              <span>جست‌وجوهای محبوب</span>
              {["گوشی سامسونگ", "آیفون", "لپ تاپ", "هدفون"].map((q) => (
                <button key={q} onClick={() => goSearch(q)}>
                  {q}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          </div>
          <div className="home-bottom">
            <div>
              <ShieldCheck size={19} /> مقایسه کن، با خیال راحت انتخاب کن
            </div>
            <button onClick={() => setModal("about")}>
              نمونه مستقل برای چالش ترب <Info size={15} />
            </button>
          </div>
        </main>
      ) : (
        <main id="main" className="results-page">
          <div className="breadcrumb">
            <button onClick={goHome}>ترب</button>
            <ChevronLeft size={12} />
            <span>{showSaved ? "ذخیره‌شده‌ها" : "جست‌وجوی محصول"}</span>
            <ChevronLeft size={12} />
            <strong>{showSaved ? `${fa(saved.length)} محصول` : query}</strong>
            <span className="dataset-label">
              <span className="green-dot" /> متصل به دیتاست چالش
            </span>
          </div>
          <section className="inperson-banner">
            <div className="banner-icon">
              <Store size={26} />
              <span className="little-spark">✦</span>
            </div>
            <div>
              <div className="banner-eyebrow">
                ترب همراه <span>دستیار خرید حضوری</span>
              </div>
              <h1>اول مطمئن شو، بعد راه بیفت.</h1>
              <p>محصول مناسب، فروشگاه نزدیک و یک مسیر روشن برای خرید.</p>
            </div>
            <button
              className="banner-action"
              onClick={() => setAssistantOpen(true)}
            >
              کمکم کن انتخاب کنم <Sparkles size={17} />
            </button>
            <div className="banner-art" aria-hidden="true">
              <div className="route-line" />
              <span className="route-point">
                <MapPin size={23} />
              </span>
              <span className="store-art">
                <Store size={52} />
              </span>
              <span className="route-check">
                <Check size={18} />
              </span>
            </div>
          </section>
          <div className="workspace">
            <aside className={"filters " + (filtersOpen ? "mobile-open" : "")}>
              <div className="filter-heading">
                <h2>
                  <SlidersHorizontal size={17} /> فیلترها
                </h2>
                <button onClick={resetFilters}>حذف همه</button>
                <button
                  className="mobile-only icon-button"
                  aria-label="بستن فیلترها"
                  onClick={() => setFiltersOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="filter-section">
                <label>نوع خرید</label>
                <div className="purchase-switch">
                  <button
                    className={mode === "inperson" ? "active" : ""}
                    onClick={() => setMode("inperson")}
                  >
                    <Store size={15} /> حضوری
                  </button>
                  <button
                    className={mode === "all" ? "active" : ""}
                    onClick={() => setMode("all")}
                  >
                    همه آفرها
                  </button>
                </div>
                <p className="tiny muted">
                  {mode === "inperson"
                    ? "فروشگاه‌های تهران با آفر ثبت‌شده"
                    : "این دیتاست فقط فروشگاه‌های حضوری تهران را دارد."}
                </p>
              </div>
              <div className="filter-section">
                <label>
                  <MapPin size={15} /> محدوده خرید
                </label>
                <button
                  className="location-select"
                  onClick={() => setModal("location")}
                >
                  <span>{customPosition ? "موقعیت فعلی من" : place}</span>
                  <ChevronDown size={14} />
                </button>
                <div className="range-label">
                  <span>شعاع فروشگاه‌ها</span>
                  <strong>{fa(radius)} کیلومتر</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  aria-label="شعاع فروشگاه‌ها"
                />
                <p className="tiny muted">
                  روی فهرست فروشندگان محصول اعمال می‌شود.
                </p>
              </div>
              <div className="filter-section">
                <label htmlFor="budget">
                  حداکثر قیمت <small>تومان</small>
                </label>
                <input
                  className="budget-input"
                  id="budget"
                  type="number"
                  min="0"
                  step="1000000"
                  placeholder="بدون محدودیت"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
                <div className="budget-presets">
                  {[20, 40, 80].map((n) => (
                    <button
                      key={n}
                      className={Number(budget) === n * 1e6 ? "selected" : ""}
                      onClick={() => setBudget(String(n * 1e6))}
                    >
                      {fa(n)} میلیون
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-section">
                <label htmlFor="brand">برند</label>
                <select
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option value="">همه برندها</option>
                  <option>سامسونگ</option>
                  <option>شیائومی</option>
                  <option>اپل</option>
                  <option>ایسوس</option>
                  <option>لنوو</option>
                  <option>سونی</option>
                </select>
              </div>
              <div className="filter-section toggle-filters">
                <label className="toggle-row">
                  <span>
                    <Wallet size={16} /> خرید اعتباری / قسطی
                  </span>
                  <input
                    type="checkbox"
                    checked={installment}
                    onChange={(e) => setInstallment(e.target.checked)}
                  />
                </label>
                <p className="tiny muted">
                  فقط سرویس با کانال حضوری اعلام‌شده؛ کانال آنلاین یا نامشخص حذف
                  می‌شود. شرایط نهایی نیازمند استعلام است.
                </p>
                <label className="toggle-row">
                  <span>
                    <Clock size={16} /> طبق برنامه باز باشد
                  </span>
                  <input
                    type="checkbox"
                    checked={onlyOpen}
                    onChange={(e) => setOnlyOpen(e.target.checked)}
                  />
                </label>
              </div>
              <div className="data-note">
                <Info size={17} />
                <p>
                  قیمت‌ها از دیتاست چالش هستند. آفر ثبت‌شده به معنی موجودی قطعی
                  نیست.
                </p>
              </div>
              <button
                className="primary mobile-only"
                onClick={() => setFiltersOpen(false)}
              >
                نمایش نتایج
              </button>
            </aside>
            <section className="catalogue">
              <div className="catalogue-heading">
                <div>
                  <h2>
                    {showSaved
                      ? "محصولات ذخیره‌شده"
                      : selected
                        ? "فروشندگان محصول"
                        : query}
                  </h2>
                  <p>
                    {loading
                      ? "در حال جست‌وجو در کاتالوگ کامل…"
                      : showSaved
                        ? `${fa(saved.length)} محصول برای بررسی بعدی`
                        : `${fa(total)} محصول در دیتاست`}
                  </p>
                </div>
                <button
                  className="mobile-filter"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal size={16} /> فیلترها
                </button>
                {selected ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelected(null);
                      setView("products");
                    }}
                  >
                    بازگشت به نتایج <ArrowLeft size={16} />
                  </button>
                ) : (
                  <div className="view-switch">
                    <button
                      className={view === "products" ? "active" : ""}
                      onClick={() => setView("products")}
                    >
                      <List size={16} /> محصولات
                    </button>
                    <button
                      onClick={() =>
                        notify(
                          "برای دیدن نقشه، یک محصول را انتخاب کنید تا فروشندگان همان محصول نمایش داده شوند.",
                        )
                      }
                    >
                      <MapIcon size={16} /> نقشه
                    </button>
                  </div>
                )}
              </div>
              {activeFilters.length ? (
                <div className="active-filters">
                  {activeFilters.map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                  <button onClick={resetFilters}>پاک کردن</button>
                </div>
              ) : null}
              {!selected ? (
                <>
                  <div className="sort-bar">
                    <SlidersHorizontal size={15} />
                    <span>مرتب‌سازی:</span>
                    {[
                      ["recommended", "مرتبط‌ترین"],
                      ["price", "ارزان‌ترین"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={sort === id ? "active" : ""}
                        onClick={() => setSort(id)}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="sort-spacer" />
                    <small>
                      <MapPin size={13} /> تهران
                    </small>
                  </div>
                  {error ? (
                    <div className="empty-state">
                      <Info />
                      <h3>دریافت اطلاعات انجام نشد</h3>
                      <p>{error}</p>
                      <button
                        onClick={() => {
                          setQuery((q) => q + " ");
                        }}
                      >
                        تلاش دوباره
                      </button>
                    </div>
                  ) : loading && !displayProducts.length ? (
                    <div className="loading-state">
                      <LoaderCircle className="spin" />
                      <p>در حال آماده‌سازی جست‌وجوی کامل…</p>
                    </div>
                  ) : !displayProducts.length ? (
                    <div className="empty-state">
                      <Search size={36} />
                      <h3>
                        {showSaved
                          ? "هنوز محصولی ذخیره نکردی"
                          : "محصولی با این شرایط پیدا نشد"}
                      </h3>
                      <p>
                        {showSaved
                          ? "با زدن قلب روی کارت‌ها، اینجا نگه‌شان دار."
                          : "بودجه یا برند را تغییر بده، یا نام کوتاه‌تری جست‌وجو کن."}
                      </p>
                      <button
                        onClick={() => {
                          resetFilters();
                          if (showSaved) setShowSaved(false);
                        }}
                      >
                        بازگشت به محصولات
                      </button>
                    </div>
                  ) : (
                    <div
                      className={
                        "product-grid " + (loading ? "is-loading" : "")
                      }
                    >
                      {displayProducts.slice(0, 60).map((p, i) => (
                        <article className="product-card" key={p.id}>
                          <div className="card-image">
                            <button
                              className={
                                "save-button " +
                                (saved.some((x) => x.id === p.id)
                                  ? "is-saved"
                                  : "")
                              }
                              onClick={() => toggleSave(p)}
                              aria-label={"ذخیره " + p.title}
                            >
                              <Heart
                                size={18}
                                fill={
                                  saved.some((x) => x.id === p.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                            <button
                              className="image-link"
                              onClick={() => setSelected(p)}
                            >
                              <ProductImage p={p} />
                            </button>
                            {i === 0 && !showSaved ? (
                              <span className="card-badge">
                                <Sparkles size={12} /> گزینه‌ای برای شروع
                              </span>
                            ) : null}
                          </div>
                          <button
                            className="product-title"
                            onClick={() => setSelected(p)}
                          >
                            {p.title}
                          </button>
                          <div className="card-category">
                            {p.brand || p.category}
                          </div>
                          <div className="product-price">
                            {p.price ? (
                              <>
                                <small>از</small> <strong>{fa(p.price)}</strong>{" "}
                                <small>تومان</small>
                              </>
                            ) : (
                              <span>قیمت نامشخص</span>
                            )}
                          </div>
                          <div className="card-bottom">
                            <button onClick={() => setSelected(p)}>
                              <Store size={14} />
                              <span>{fa(p.count)} آفر ثبت‌شده</span>
                              <ChevronLeft size={13} />
                            </button>
                            <button
                              className={
                                "compare-button " +
                                (compare.some((x) => x.id === p.id)
                                  ? "is-selected"
                                  : "")
                              }
                              onClick={() => toggleCompare(p)}
                              aria-label={"مقایسه " + p.title}
                            >
                              {compare.some((x) => x.id === p.id) ? (
                                <Check size={17} />
                              ) : (
                                <Scale size={17} />
                              )}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {products.length > 60 && !loading ? (
                    <p className="results-limit">
                      ۶۰ نتیجه نخست نمایش داده شده؛ برای نتیجه دقیق‌تر، جست‌وجو
                      یا فیلترها را محدود کنید.
                    </p>
                  ) : null}
                </>
              ) : detailLoading ? (
                <div className="loading-state">
                  <LoaderCircle className="spin" /> در حال دریافت جزئیات و
                  فروشندگان…
                </div>
              ) : detail ? (
                <>
                  <div className="detail-product">
                    <div className="detail-image">
                      <ProductImage p={detail} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        {detail.brand || detail.category}
                      </span>
                      <h2>{detail.title}</h2>
                      <div className="detail-price">{money(detail.price)}</div>
                      <div className="detail-actions">
                        <button
                          onClick={() => {
                            toggleCompare(detail);
                          }}
                        >
                          <Scale size={16} /> مقایسه
                        </button>
                        <button onClick={() => toggleSave(detail)}>
                          <Heart size={16} />{" "}
                          {saved.some((x) => x.id === detail.id)
                            ? "ذخیره شده"
                            : "ذخیره"}
                        </button>
                        <button onClick={() => setModal("specs")}>
                          مشخصات <ChevronLeft size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="seller-toolbar">
                    <div>
                      <strong>{fa(visibleOffers.length)} آفر در محدوده</strong>
                      <small> از {fa(offerRows.length)} آفر این محصول</small>
                    </div>
                    <div className="view-switch">
                      <button
                        className={view !== "map" ? "active" : ""}
                        onClick={() => setView("products")}
                      >
                        <List size={15} /> فهرست
                      </button>
                      <button
                        className={view === "map" ? "active" : ""}
                        onClick={() => setView("map")}
                      >
                        <MapIcon size={15} /> نقشه
                      </button>
                    </div>
                  </div>
                  <div className="seller-warning">
                    <Info size={16} />
                    <span>
                      موجودی هیچ فروشگاهی تأیید نشده. فاصله‌ها مستقیم‌اند و زمان
                      سفر نیستند.
                    </span>
                  </div>
                  <VisitPlan
                    plan={plan}
                    radius={Number(radius)}
                    onSeller={(offer) => setShopFocus(offer)}
                    onExpand={(offer) => {
                      setRadius(Math.min(30, Math.max(Number(radius), Math.ceil(offer.distance))));
                      setView("map");
                    }}
                  />
                  {view === "map" ? (
                    <MapView
                      offers={visibleOffers}
                      center={center}
                      onSelect={mapSelect}
                      onSetCenter={mapSetCenter}
                    />
                  ) : null}
                  {!shops ? (
                    <div className="loading-state">
                      <LoaderCircle className="spin" />
                      دریافت فروشگاه‌ها…
                    </div>
                  ) : !visibleOffers.length ? (
                    <div className="empty-state">
                      <Store />
                      <h3>فروشنده‌ای با این شرایط نداریم</h3>
                      <p>
                        شعاع را بیشتر کن یا فیلتر ساعت کاری و خرید اعتباری را
                        بردار.
                      </p>
                      <button
                        onClick={() => {
                          setRadius(30);
                          setOnlyOpen(false);
                          setInstallment(false);
                        }}
                      >
                        نمایش همه فروشندگان در ۳۰ کیلومتر
                      </button>
                    </div>
                  ) : (
                    <div className="seller-list">
                      {visibleOffers.map((o, i) => (
                        <Seller
                          key={o.id}
                          offer={o}
                          first={i === 0}
                          simulation={simulations[o.id]}
                          onDetail={() => setShopFocus(o)}
                          onInquiry={() => {
                            setShopFocus(o);
                            setModal("inquiry");
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="alternative-box">
                    <RotateCcw size={20} />
                    <div>
                      <strong>این گزینه مناسب نبود؟</strong>
                      <p>مدل‌های دیگر را با همین بودجه و برند بررسی کن.</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelected(null);
                        setView("products");
                      }}
                    >
                      دیدن جایگزین‌ها <ArrowLeft size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p>اطلاعات محصول دریافت نشد.</p>
                  <button onClick={() => setSelected({ ...selected })}>
                    تلاش دوباره
                  </button>
                </div>
              )}
            </section>
            <aside
              className={"assistant-panel " + (assistantOpen ? "is-open" : "")}
            >
              <div className="assistant-header">
                <div className="assistant-avatar">
                  <Sparkles size={21} />
                </div>
                <div>
                  <h2>
                    ترب همراه <span className="green-dot" />
                  </h2>
                  <p>از انتخاب تا درِ فروشگاه</p>
                </div>
                <button
                  className="icon-button"
                  onClick={resetConversation}
                  aria-label="شروع گفت‌وگوی تازه"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  className="icon-button close-assistant"
                  onClick={() => setAssistantOpen(false)}
                  aria-label="بستن دستیار"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="assistant-journey">
                <span className={!selected ? "current" : "done"}>
                  <i>{selected ? <Check size={11} /> : 1}</i> انتخاب محصول
                </span>
                <div />
                <span className={selected ? "current" : ""}>
                  <i>۲</i> فروشگاه
                </span>
                <div />
                <span>
                  <i>۳</i> مراجعه
                </span>
              </div>
              <div className="assistant-context">
                <MapPin size={13} />
                <span>{customPosition ? "موقعیت من" : place}</span>
                <span>•</span>
                <span>
                  {budget
                    ? `تا ${fa(Number(budget) / 1e6)} میلیون`
                    : "بودجه آزاد"}
                </span>
                <button onClick={() => setModal("location")}>ویرایش</button>
              </div>
              <div className="messages" aria-live="polite">
                {messages.map((m, i) => (
                  <div className={"message " + m.role} key={i}>
                    {m.role === "assistant" ? (
                      <span className="message-label">
                        <Sparkles size={12} /> ترب همراه
                      </span>
                    ) : null}
                    {m.role === "assistant" ? (
                      <div className="message-markdown">
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} target="_blank" rel="noreferrer" />
                            ),
                          }}
                        >
                          {m.text}
                        </Markdown>
                      </div>
                    ) : (
                      <p>{m.text}</p>
                    )}
                    <AssistantCards
                      actions={m.actions}
                      busyInquiry={busyInquiry || chatBusy}
                      onSimulate={runSimulation}
                      onProduct={(p) => {
                        setSelected(p);
                        setPage("results");
                        setView("products");
                      }}
                      onSeller={(o) => {
                        setShopFocus(o);
                        setModal("shop");
                      }}
                    />
                    {m.tools?.length ? (
                      <div className="tool-results">
                        {m.tools.map((tool, i) => (
                          <span
                            key={i}
                            className={
                              tool.status === "error" ? "tool-error" : ""
                            }
                          >
                            <CheckCircle2 size={11} />
                            {{
                              search_products: "جست‌وجوی محصولات",
                              compare_products: "مقایسه مشخصات",
                              find_sellers: "بررسی فروشندگان",
                              get_shop_details: "اطلاعات فروشگاه",
                              request_inquiry: "استعلام آزمایشی",
                              find_alternatives: "گزینه‌های جایگزین",
                              suggest_market_areas: "بررسی ناحیه خرید و نقشه",
                            }[tool.name] || "بررسی داده‌ها"}
                            {tool.status === "error" ? " · انجام نشد" : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {m.provider === "local" ? (
                      <small className="local-reply-label">
                        پاسخ محلی · بدون مدل زبانی
                      </small>
                    ) : null}
                    {m.role === "user" ? <CheckCheck size={12} /> : null}
                  </div>
                ))}
                {messages.length === 1 ? (
                  <>
                    <div className="assistant-intro-card">
                      <div className="intro-illustration">
                        <Store size={39} />
                        <span>
                          <MapPin size={18} />
                        </span>
                      </div>
                      <strong>یک همراه برای خرید حضوری</strong>
                      <p>
                        با هم انتخاب می‌کنیم، مقایسه می‌کنیم و فروشگاه مناسب را
                        پیدا می‌کنیم.
                      </p>
                    </div>
                    <div className="prompt-chips">
                      <span>از اینجا شروع کن</span>
                      {[
                        "گوشی سامسونگ تا ۳۰ میلیون",
                        "فروشگاه نزدیک جمهوری می‌خوام",
                        "فقط خرید قسطی",
                      ].map((x, i) => (
                        <button key={x} onClick={() => sendChat(x)}>
                          {i === 0 ? (
                            <Smartphone size={15} />
                          ) : i === 1 ? (
                            <MapPin size={15} />
                          ) : (
                            <Wallet size={15} />
                          )}{" "}
                          {x}
                          <ArrowUpLeftIcon />
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {chatBusy ? (
                  <div className="chat-thinking" role="status">
                    <LoaderCircle className="spin" size={15} /> در حال بررسی
                    درخواست و اطلاعات…
                  </div>
                ) : null}
                {failedRequest ? (
                  <div className="chat-error" role="alert">
                    <p>{failedRequest.error}</p>
                    <button
                      onClick={() => sendChat("", failedRequest.request)}
                      disabled={chatBusy}
                    >
                      <RotateCcw size={13} /> تلاش دوباره برای همین پیام
                    </button>
                  </div>
                ) : null}
                <div ref={chatEnd} />
              </div>
              {selected ? (
                <div className="assistant-selection">
                  <ProductImage p={selected} />
                  <div>
                    <small>در حال بررسی</small>
                    <strong>{selected.title}</strong>
                  </div>
                  <CheckCircle2 size={17} />
                </div>
              ) : null}
              <form
                className="chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
              >
                <div>
                  <textarea
                    rows={1}
                    aria-label="پیام به دستیار"
                    placeholder="بگو دنبال چی می‌گردی…"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                  />
                  <button
                    disabled={!chatText.trim() || chatBusy}
                    aria-label="ارسال پیام"
                  >
                    <ArrowUp size={20} />
                  </button>
                </div>
                <p>
                  <ShieldCheck size={11} />{" "}
                  {backendInfo?.assistant?.configured
                    ? "مدل زبانی متصل"
                    : "مدل زبانی تنظیم نشده"}{" "}
                  • بدون تماس واقعی
                </p>
              </form>
            </aside>
          </div>
          <div className="results-footer">
            <span>ترب همراه · نمونه مستقل چالش خرید حضوری</span>
            <button onClick={() => setModal("about")}>
              درباره داده‌ها و محدودیت‌ها <Info size={13} />
            </button>
          </div>
        </main>
      )}
      {page === "home" ? (
        <footer className="site-footer">
          <div>
            {[
              "راهنمای خرید امن",
              "پیگیری سفارش",
              "پشتیبانی",
              "درباره ترب",
              "پیشنهاد ویژه",
              "نصب اپلیکیشن",
            ].map((t) => (
              <a
                key={t}
                href="https://torob.com/"
                target="_blank"
                rel="noreferrer"
              >
                {t}
              </a>
            ))}
          </div>
          <div>
            {[
              "ترب‌پی",
              "لیست فروشگاه‌ها",
              "ثبت نام فروشگاه",
              "پنل فروشگاه‌ها",
              "فرصت‌های شغلی",
              "بلاگ ترب",
            ].map((t) => (
              <a
                key={t}
                href="https://torob.com/"
                target="_blank"
                rel="noreferrer"
              >
                {t}
              </a>
            ))}
          </div>
        </footer>
      ) : null}
      {page === "results" ? (
        <button
          className="assistant-fab"
          onClick={() => setAssistantOpen(!assistantOpen)}
        >
          <Sparkles size={20} /> ترب همراه <span className="green-dot" />
        </button>
      ) : null}
      {compare.length ? (
        <div className="compare-tray">
          <Scale size={21} />
          <div>
            <strong>مقایسه محصولات</strong>
            <small>{fa(compare.length)} از ۳ محصول</small>
          </div>
          <div className="compare-thumbs">
            {compare.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleCompare(p)}
                aria-label={"حذف از مقایسه " + p.title}
              >
                <ProductImage p={p} />
                <X size={11} />
              </button>
            ))}
          </div>
          <button
            className="primary"
            disabled={compare.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            مقایسه <ArrowLeft size={15} />
          </button>
          <button
            className="icon-button"
            onClick={() => setCompare([])}
            aria-label="پاک کردن مقایسه"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <Info size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="بستن اعلان">
            <X size={15} />
          </button>
        </div>
      ) : null}
      {modal === "location" ? (
        <Modal title="کجا می‌خواهی خرید کنی؟" onClose={() => setModal(null)}>
          <div className="modal-body">
            <p className="muted">
              فروشگاه‌های دیتاست در تهران هستند. محدوده برای محاسبه فاصله مستقیم
              استفاده می‌شود.
            </p>
            <button className="geolocate" onClick={locate}>
              <LocateFixed size={20} /> استفاده از موقعیت من
            </button>
            <label className="field-label">یا یک محدوده را انتخاب کن</label>
            <div className="place-grid">
              {Object.keys(places).map((p) => (
                <button
                  key={p}
                  className={p === place && !customPosition ? "active" : ""}
                  onClick={() => {
                    setPlace(p);
                    setCustomPosition(null);
                    setModal(null);
                  }}
                >
                  <MapPin size={17} />
                  {p}
                  {p === place && !customPosition ? <Check size={15} /> : null}
                </button>
              ))}
            </div>
            <p className="tiny muted">
              پوشش فروشگاه‌ها در همه محله‌های تهران یکسان نیست.
            </p>
          </div>
        </Modal>
      ) : null}
      {modal === "categories" ? (
        <Modal title="دسته‌بندی کالاها" onClose={() => setModal(null)}>
          <div className="modal-body category-grid">
            {categories.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => {
                  resetFilters();
                  goSearch(name);
                  setModal(null);
                }}
              >
                <Icon size={28} />
                {name}
                <ChevronLeft size={16} />
              </button>
            ))}
            <p className="tiny muted">
              با جست‌وجو به همه دسته‌های موجود در دیتاست دسترسی داری.
            </p>
          </div>
        </Modal>
      ) : null}
      {modal === "about" ? (
        <Modal title="درباره ترب همراه" onClose={() => setModal(null)}>
          <div className="modal-body about-body">
            <div className="about-logo">
              <Logo />
              <span>نمونه مستقل چالش خرید حضوری</span>
            </div>
            <p>
              این پروژه بازطراحی آزمایشی تجربه ترب است و به سرویس رسمی ترب متصل
              نیست.
            </p>
            <section className="theme-settings">
              <h3>ظاهر سایت</h3>
              <div>
                {[
                  ["light", "روشن", Sun],
                  ["dark", "تاریک", Moon],
                  ["system", "همگام با سیستم", Monitor],
                ].map(([value, label, Icon]) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                  >
                    <Icon size={16} />
                    {label}
                    {theme === value ? <Check size={14} /> : null}
                  </button>
                ))}
              </div>
            </section>
            <div className="stats-row">
              <div>
                <strong>{meta ? fa(meta.products) : "۲۲۵٬۹۰۳"}</strong>
                <small>محصول</small>
              </div>
              <div>
                <strong>{meta ? fa(meta.shops) : "۶٬۴۷۶"}</strong>
                <small>فروشگاه</small>
              </div>
              <div>
                <strong>{meta ? fa(meta.offers) : "۳۳۱٬۵۰۶"}</strong>
                <small>آفر ثبت‌شده</small>
              </div>
            </div>
            <ul>
              <li>
                تمام محصولات و آفرها از دیتاست ارائه‌شده در چالش خوانده می‌شوند.
              </li>
              <li>
                شماره‌های فروشگاه‌ها و بیشتر نام‌ها جعلی‌اند. تماس یا پیام واقعی
                ارسال نمی‌شود.
              </li>
              <li>
                قیمت ثبت‌شده و تاریخ تغییر آن، تأیید موجودی یا قیمت امروز نیست.
              </li>
              <li>
                {backendInfo?.assistant?.configured
                  ? "دستیار به مدل زبانی متصل است و با ابزارهای سمت سرور، داده‌های محصولات و فروشگاه‌ها را بررسی می‌کند."
                  : "اتصال مدل در بک‌اند پیاده شده؛ کلید API هنوز تنظیم نشده و پاسخ‌های فعلی در حالت محلی هستند."}
              </li>
              <li>
                ساعت کاری بر اساس اطلاعات اعلام‌شده و زمان تهران است؛ تعطیلی
                استثنایی مشخص نیست.
              </li>
              <li>
                اطلاعات خالی شرایط پرداخت، به معنی عدم پذیرندگی نیست؛ کانال
                نامشخص را حضوری تلقی نمی‌کنیم.
              </li>
            </ul>
            <a
              className="text-link"
              href="https://torob.com"
              target="_blank"
              rel="noreferrer"
            >
              مشاهده سایت اصلی ترب <ExternalLink size={15} />
            </a>
          </div>
        </Modal>
      ) : null}
      {modal === "specs" && detail ? (
        <Modal title="مشخصات ثبت‌شده محصول" onClose={() => setModal(null)}>
          <div className="modal-body">
            <h3>{detail.title}</h3>
            {detail.specs.length ? (
              <dl className="spec-list">
                {detail.specs.map((s, i) => (
                  <div key={i}>
                    <dt>{s.key}</dt>
                    <dd>
                      {typeof s.value === "object"
                        ? JSON.stringify(s.value)
                        : String(s.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">
                مشخصات فنی این محصول در دیتاست ثبت نشده است.
              </p>
            )}
          </div>
        </Modal>
      ) : null}
      {shopFocus ? (
        <Modal
          title={
            modal === "inquiry" ? "استعلام آزمایشی فروشگاه" : "اطلاعات فروشگاه"
          }
          onClose={() => {
            setShopFocus(null);
            if (modal === "inquiry") setModal(null);
          }}
        >
          <div className="modal-body shop-modal">
            <div className="shop-modal-title">
              <span className="shop-avatar">
                <Store size={26} />
              </span>
              <div>
                <h3>{shopFocus.shop.name}</h3>
                <span className="tiny muted">
                  نام فروشگاه ممکن است مستعار باشد
                </span>
              </div>
            </div>
            <p>
              <MapPin size={17} />
              {shopFocus.shop.address || "آدرس ثبت نشده"}
            </p>
            {addressGuide(shopFocus.shop.address) ? (
              <div className="address-guide">
                <strong><Store size={16} /> راهنمای پیدا کردن فروشگاه در ساختمان</strong>
                <div>
                  {Object.entries(addressGuide(shopFocus.shop.address)).filter(([, value]) => value).map(([key, value]) => (
                    <span key={key}><small>{{ building: "ساختمان / بازار", floor: "طبقه", unit: "واحد / پلاک" }[key]}</small>{value}</span>
                  ))}
                </div>
                <small>این نشانه‌ها عیناً از آدرس ثبت‌شده‌اند؛ مسیر داخل ساختمان ثبت نشده است.</small>
              </div>
            ) : null}
            <p>
              <Navigation size={16} />
              {shopFocus.distance != null
                ? `${fa(shopFocus.distance.toFixed(1))} کیلومتر فاصله مستقیم`
                : "فاصله نامشخص"}
            </p>
            <div className="shop-price">
              قیمت ثبت‌شده <strong>{money(shopFocus.price)}</strong>
            </div>
            <p className="tiny muted">
              آخرین تغییر قیمت: {dateLabel(shopFocus.changed)}
            </p>
            <p className="tiny muted">
              گارانتی:{" "}
              {shopFocus.warranty
                ? typeof shopFocus.warranty === "string"
                  ? shopFocus.warranty
                  : [
                      shopFocus.warranty.provider,
                      shopFocus.warranty.period_months
                        ? fa(shopFocus.warranty.period_months) + " ماهه"
                        : null,
                      shopFocus.warranty.description,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "جزئیات ثبت نشده"
                : "ثبت نشده"}
            </p>
            {shopFocus.shop.payment_options?.length ? (
              <div className="payment-details">
                <strong>سرویس‌های اعلام‌شده</strong>
                {shopFocus.shop.payment_options.map((p, i) => (
                  <p key={i}>
                    {p.provider_name}{" "}
                    <small>
                      {" "}
                      ·{" "}
                      {[
                        "offline",
                        "in_person",
                        "inperson",
                        "physical",
                      ].includes(p.channel)
                        ? "حضوری اعلام‌شده"
                        : p.channel === "online"
                          ? "آنلاین اعلام‌شده"
                          : "کانال پذیرندگی نامشخص"}
                    </small>
                  </p>
                ))}
              </div>
            ) : (
              <p className="tiny muted">اطلاعات شرایط پرداخت ثبت نشده است.</p>
            )}
            <details className="hours-details">
              <summary>ساعت کاری هفتگی (اعلام‌شده)</summary>
              {shopFocus.shop.weekly_hours ? (
                <ul>
                  {[
                    ["sat", "شنبه"],
                    ["sun", "یکشنبه"],
                    ["mon", "دوشنبه"],
                    ["tue", "سه‌شنبه"],
                    ["wed", "چهارشنبه"],
                    ["thu", "پنجشنبه"],
                    ["fri", "جمعه"],
                  ].map(([key, name]) => {
                    const d = shopFocus.shop.weekly_hours[key];
                    return (
                      <li key={key}>
                        <span>{name}</span>
                        <span>
                          {d?.status === "closed"
                            ? "تعطیل"
                            : d?.status === "declared"
                              ? d.shifts
                                  .map(
                                    (s) =>
                                      s.start_time.slice(0, 5) +
                                      " تا " +
                                      s.end_time.slice(0, 5),
                                  )
                                  .join(" / ")
                              : "نامشخص"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>ساعت کاری ثبت نشده است.</p>
              )}
            </details>
            {shopLinks[shopFocus.shop.shop_id] ? (
              <div className="public-shop-links">
                <small>
                  لینک ثبت‌شده فروشنده در دیتاست؛ قیمت و موجودی امروز از این
                  طریق تأیید نشده است.
                </small>
                {shopLinks[shopFocus.shop.shop_id].website_url ? (
                  <a
                    href={shopLinks[shopFocus.shop.shop_id].website_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    وبسایت ثبت‌شده فروشگاه ↗
                  </a>
                ) : null}
                {shopLinks[shopFocus.shop.shop_id].instagram ? (
                  <a
                    href={shopLinks[shopFocus.shop.shop_id].instagram}
                    target="_blank"
                    rel="noreferrer"
                  >
                    اینستاگرام ثبت‌شده فروشگاه ↗
                  </a>
                ) : null}
              </div>
            ) : null}
            <a
              className="primary route-button"
              href={`https://www.google.com/maps/dir/?api=1&destination=${shopFocus.shop.lat},${shopFocus.shop.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={17} /> مسیریابی به مختصات ثبت‌شده{" "}
              <ExternalLink size={14} />
            </a>
            <div className="inquiry-demo">
              <span className="demo-label">محیط آزمایشی · بدون تماس واقعی</span>
              <p>
                شماره‌های دیتاست جعلی‌اند. یکی از پاسخ‌های فرضی زیر را انتخاب کن
                تا رفتار جایگزین‌یابی دستیار را ببینی.
              </p>
              <div>
                <button
                  disabled={!!busyInquiry || chatBusy}
                  onClick={() => simulate(shopFocus, "available")}
                >
                  سناریو: موجود است
                </button>
                <button
                  disabled={!!busyInquiry || chatBusy}
                  onClick={() => simulate(shopFocus, "unavailable")}
                >
                  سناریو: ناموجود
                </button>
                <button
                  disabled={!!busyInquiry || chatBusy}
                  onClick={() => simulate(shopFocus, "noanswer")}
                >
                  سناریو: عدم پاسخ
                </button>
              </div>
              {simulations[shopFocus.id] ? (
                <p className="demo-result">
                  آخرین پاسخ فرضی:{" "}
                  {simulations[shopFocus.id] === "available"
                    ? "موجود است"
                    : simulations[shopFocus.id] === "unavailable"
                      ? "ناموجود"
                      : "عدم پاسخ"}{" "}
                  · موجودی واقعی همچنان تأیید نشده
                </p>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
      {compareOpen ? (
        <Modal
          title="مقایسه محصولات"
          onClose={() => setCompareOpen(false)}
          wide
        >
          <div className="modal-body compare-body">
            {compareDetails.length !== compare.length ? (
              <div className="loading-state">
                <LoaderCircle className="spin" /> دریافت مشخصات…
              </div>
            ) : (
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>ویژگی</th>
                    {compareDetails.map((p) => (
                      <th key={p.id}>
                        <ProductImage p={p} />
                        <span>{p.title}</span>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected(p);
                            setCompareOpen(false);
                          }}
                        >
                          دیدن فروشندگان <ChevronLeft size={14} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>کمترین قیمت ثبت‌شده</th>
                    {compareDetails.map((p) => (
                      <td key={p.id}>{money(p.price)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>برند</th>
                    {compareDetails.map((p) => (
                      <td key={p.id}>{p.brand || "ثبت نشده"}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>آفر ثبت‌شده</th>
                    {compareDetails.map((p) => (
                      <td key={p.id}>{fa(p.count)}</td>
                    ))}
                  </tr>
                  {[
                    ...new Set(
                      compareDetails.flatMap((p) => p.specs.map((s) => s.key)),
                    ),
                  ]
                    .slice(0, 35)
                    .map((key) => (
                      <tr key={key}>
                        <th>{key}</th>
                        {compareDetails.map((p) => (
                          <td key={p.id}>
                            {String(
                              p.specs.find((s) => s.key === key)?.value ??
                                "ثبت نشده",
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  <tr>
                    <th>موجودی</th>
                    {compareDetails.map((p) => (
                      <td key={p.id}>تأیید نشده</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
function ArrowUpLeftIcon() {
  return <ArrowLeft size={13} className="prompt-arrow" />;
}
function Seller({ offer: o, first, simulation, onDetail, onInquiry }) {
  const h = hoursStatus(o.shop);
  return (
    <article
      className={
        "seller-card " + (simulation === "unavailable" ? "unavailable" : "")
      }
    >
      <div className="seller-top">
        <div className="shop-avatar">
          <Store size={21} />
        </div>
        <div className="seller-name">
          <button onClick={onDetail}>
            {o.shop.name}
            <ChevronLeft size={13} />
          </button>
          <span>
            <MapPin size={12} />
            {o.shop.location_label || "تهران"} <i>·</i>{" "}
            {o.distance != null
              ? `${fa(o.distance.toFixed(1))} کیلومتر`
              : "فاصله نامشخص"}
          </span>
        </div>
        {first ? (
          <span className="nearest-badge">نزدیک‌ترین در نتایج</span>
        ) : null}
      </div>
      <p className="seller-address">{o.shop.address || "آدرس ثبت نشده"}</p>
      <div className="seller-tags">
        <span className={h.state}>
          <Clock size={12} />
          {h.label}
        </span>
        {o.shop.payment_options?.length > 0 ? (
          <span className="payment-tag">
            <Wallet size={12} />
            {o.shop.payment_options.map((p) => p.provider_name).join("، ")} ·
            نیازمند استعلام
          </span>
        ) : null}
        <span className="unknown-stock">موجودی تأیید نشده</span>
      </div>
      {simulation ? (
        <div className="simulation-result">
          پاسخ فرضی:{" "}
          {simulation === "available"
            ? "موجود است"
            : simulation === "unavailable"
              ? "ناموجود — آفر دیگری انتخاب کنید"
              : "فروشنده پاسخ نداد — آفر دیگری انتخاب کنید"}
        </div>
      ) : null}
      <div className="seller-bottom">
        <div>
          <strong>{money(o.price)}</strong>
          <small>آخرین تغییر قیمت: {dateLabel(o.changed)}</small>
        </div>
        <div>
          <button className="outline-button" onClick={onInquiry}>
            <MessageCircle size={15} /> استعلام آزمایشی
          </button>
          <button
            className="seller-route"
            onClick={onDetail}
            aria-label="آدرس و مسیریابی"
          >
            <Navigation size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
