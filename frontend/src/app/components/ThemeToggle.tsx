"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { updateUserTheme } from "../lib/api";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (user) {
      const userThemeLocal = localStorage.getItem(`spendly_theme_${user.id}`);
      // Default to user's DB preference (false = light mode), or local override if explicitly set
      const isDarkToApply = userThemeLocal !== null ? userThemeLocal === "dark" : (user.is_dark_mode ?? false);

      if (isDarkToApply) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
        setDark(true);
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
        setDark(false);
      }
    }
  }, [user]);

  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    setDark(isDark);
    const themeStr = isDark ? "dark" : "light";
    localStorage.setItem("theme", themeStr);
    if (user?.id) {
      localStorage.setItem(`spendly_theme_${user.id}`, themeStr);
      updateUserTheme(isDark).catch(() => {});
    }
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? (
        /* Sun icon */
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
        </svg>
      ) : (
        /* Moon icon */
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
