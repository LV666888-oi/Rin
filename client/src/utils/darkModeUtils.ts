import { useState, useEffect } from "react";

type ThemeMode = "light" | "dark" | "system";

function applyColorMode(mode: ThemeMode) {
  let actualMode: "light" | "dark";

  if (mode === "dark" || mode === "light") {
    actualMode = mode;
  } else {
    actualMode = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  document.documentElement.setAttribute("data-color-mode", actualMode);

  window.dispatchEvent(new Event("colorSchemeChange"));
}

export function listenSystemMode() {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function darkModeHandler() {
    const savedMode = localStorage.getItem("theme");

    const mode: ThemeMode =
      savedMode === "dark" || savedMode === "light"
        ? savedMode
        : "system";

    applyColorMode(mode);
  }

  // 页面启动时立即恢复用户保存的主题
  darkModeHandler();

  // 监听系统主题变化
  mediaQuery.addEventListener("change", () => {
    const mode = localStorage.getItem("theme");

    if (mode === null || mode === "system") {
      applyColorMode("system");
    }
  });
}

export function getCurrentColorMode(): "light" | "dark" {
  return (
    (document.documentElement.getAttribute("data-color-mode") as
      | "light"
      | "dark") || "light"
  );
}

export function useColorMode() {
  const [colorMode, setColorMode] = useState<"light" | "dark">(
    getCurrentColorMode()
  );

  useEffect(() => {
    const updateColorMode = () => {
      setColorMode(getCurrentColorMode());
    };

    updateColorMode();

    window.addEventListener("colorSchemeChange", updateColorMode);

    return () => {
      window.removeEventListener("colorSchemeChange", updateColorMode);
    };
  }, []);

  return colorMode;
}
