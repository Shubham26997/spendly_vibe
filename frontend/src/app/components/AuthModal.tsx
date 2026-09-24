"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestForgotPassword, resetPassword } from "../lib/api";
import ThemeToggle from "./ThemeToggle";

type AuthMode = "login" | "register" | "forgot" | "reset";

export function AuthModal() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "register") {
        await register(email, password, fullName);
      } else if (mode === "login") {
        await login(email, password);
      } else if (mode === "forgot") {
        const res = await requestForgotPassword(email);
        setSuccess(res.message || "A 6-digit OTP code has been sent to your email address.");
        setMode("reset");
      } else if (mode === "reset") {
        const res = await resetPassword(email, otp, newPassword);
        setSuccess(res.message || "Password reset successfully! Please sign in with your new password.");
        setPassword(newPassword);
        setNewPassword("");
        setOtp("");
        setMode("login");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (newMode: AuthMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setEmail("");
    setPassword("");
    setFullName("");
    setOtp("");
    setNewPassword("");
    setShowPassword(false);
    setShowNewPassword(false);
  };

  const fillDemo = () => {
    setEmail("demo@spendly.app");
    setPassword("password123");
    setMode("login");
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-colors">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md p-8 bg-white/95 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl transition-colors">
        {/* Light/Dark Theme Toggle */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        {/* Brand logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white font-bold text-2xl shadow-lg shadow-emerald-500/20">
            S
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Spendly
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "forgot"
              ? "Request a password reset code"
              : mode === "reset"
              ? "Set your new account password"
              : "Personal Expense & AI Insight Dashboard"}
          </p>
        </div>

        {/* Tab switch for Login / Register */}
        {(mode === "login" || mode === "register") && (
          <div className="flex p-1 mb-6 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/40">
            <button
              type="button"
              onClick={() => handleTabSwitch("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white dark:bg-zinc-700/90 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "register"
                  ? "bg-white dark:bg-zinc-700/90 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Success notification */}
        {success && (
          <div className="p-3 mb-5 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
            {success}
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 mb-5 text-sm text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl">
            {error}
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul@example.com"
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-colors"
            />
          </div>

          {(mode === "login" || mode === "register") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Password
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-11 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-10-7-10-7a19.497 19.497 0 014.2-4.542m3.2-1.63A9.97 9.97 0 0112 5c7 0 10 7 10 7a19.5 19.5 0 01-2.16 2.94m-4.02 2.45a3.5 3.5 0 11-4.95-4.95M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === "reset" && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-white tracking-widest text-center font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none transition-colors"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-10-7-10-7a19.497 19.497 0 014.2-4.542m3.2-1.63A9.97 9.97 0 0112 5c7 0 10 7 10 7a19.5 19.5 0 01-2.16 2.94m-4.02 2.45a3.5 3.5 0 11-4.95-4.95M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {mode === "register"
                  ? "Creating Account..."
                  : mode === "forgot"
                  ? "Sending Code..."
                  : mode === "reset"
                  ? "Resetting Password..."
                  : "Signing In..."}
              </span>
            ) : mode === "register" ? (
              "Get Started"
            ) : mode === "forgot" ? (
              "Send Reset Code"
            ) : mode === "reset" ? (
              "Reset Password"
            ) : (
              "Sign In to Dashboard"
            )}
          </button>
        </form>

        {/* Back to sign in link for Forgot / Reset modes */}
        {(mode === "forgot" || mode === "reset") && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => handleTabSwitch("login")}
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Demo login option */}
        {mode === "login" && (
          <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800/80 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Want to quickly explore sample data?</p>
            <button
              type="button"
              onClick={fillDemo}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 underline underline-offset-4"
            >
              Fill Demo Credentials (demo@spendly.app)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
