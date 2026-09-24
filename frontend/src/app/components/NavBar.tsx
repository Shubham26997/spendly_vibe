"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/compare", label: "Compare", icon: "↗" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

interface NavBarProps {
  onChatOpen?: () => void;
}

export default function NavBar({ onChatOpen }: NavBarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [dangerZone, setDangerZone] = useState(false);

  useEffect(() => {
    function check() {
      setDangerZone(localStorage.getItem("spendly_zone") === "DANGER");
    }
    check();
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [farewellMessage, setFarewellMessage] = useState<string | null>(null);

  const userFirstName = user?.full_name?.trim()
    ? user.full_name.trim().split(" ")[0]
    : user?.email?.split("@")[0] || "User";

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    setFarewellMessage(`See You Soon ${userFirstName}`);
    setTimeout(() => {
      logout();
      setFarewellMessage(null);
    }, 1800);
  };

  return (
    <>
      {/* Farewell Toast Overlay */}
      {farewellMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3.5 bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 border border-zinc-700/50 dark:border-zinc-300/50 rounded-2xl shadow-2xl backdrop-blur-xl animate-bounce">
          <span className="text-xl">👋</span>
          <span className="font-bold text-base tracking-wide">{farewellMessage}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-all">
          <div className="relative w-full max-w-sm p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xl">
              🚪
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
              Logout Confirmation
            </h2>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-6">
              Do you want to logout?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/20 transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="w-full px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl leading-none">💰</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-base tracking-tight">
              Spendly
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href;
              const isDashboard = href === "/";
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <span className="text-xs opacity-70">{icon}</span>
                  <span className="relative hidden sm:inline">
                    {label}
                    {isDashboard && dangerZone && (
                      <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {onChatOpen && (
              <button
                onClick={onChatOpen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                aria-label="Open AI chat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            <ThemeToggle />

            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium hidden md:inline truncate max-w-[120px]">
                  {user.full_name || user.email}
                </span>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  title="Logout"
                  className="px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
