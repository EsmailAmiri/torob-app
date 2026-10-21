export let backendReady = false;
export function setBackendReady(ready) {
  backendReady = ready;
}
export async function api(path, { signal, ...options } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 150000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch("/api" + path, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json"))
      throw Error(
        "سرویس بک‌اند در دسترس نیست. برنامه را با npm run dev اجرا کنید.",
      );
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "درخواست انجام نشد.");
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (timedOut)
      throw Error("زمان پاسخ سرویس طولانی شد؛ همین پیام را دوباره تلاش کنید.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
export function threadId() {
  try {
    let id = localStorage.getItem("torob:thread:v1");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem("torob:thread:v1", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
export function newThread() {
  const id = crypto.randomUUID();
  try {
    localStorage.setItem("torob:thread:v1", id);
  } catch {}
  return id;
}
