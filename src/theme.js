import { useEffect, useState } from "react";
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const value = localStorage.getItem("torob:theme:v1");
      return ["light", "dark", "system"].includes(value) ? value : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    try {
      localStorage.setItem("torob:theme:v1", theme);
    } catch {}
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#14191f" : "#d72c2c");
  }, [theme, resolved]);
  return {
    theme,
    resolved,
    setTheme,
    toggleTheme: () => setTheme(resolved === "dark" ? "light" : "dark"),
  };
}
