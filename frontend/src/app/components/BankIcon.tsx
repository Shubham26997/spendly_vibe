"use client";

import React, { useState, useEffect } from "react";

interface IconProps {
  className?: string;
}

function CashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${className || "w-3.5 h-3.5"} text-emerald-600 dark:text-emerald-400 flex-shrink-0`} fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function DefaultBankIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${className || "w-3.5 h-3.5"} text-gray-500 dark:text-gray-400 flex-shrink-0`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M4 10l8-7 8 7" />
    </svg>
  );
}

interface BankIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function BankIcon({ name, className, size = 8 }: BankIconProps) {
  const [hasError, setHasError] = useState(false);
  const n = name.toLowerCase().trim();

  // Reset error state when bank name changes
  useEffect(() => {
    setHasError(false);
  }, [name]);

  if (n.includes("cash")) {
    return <CashIcon className={className} />;
  }

  if (hasError) {
    return <DefaultBankIcon className={className} />;
  }

  // Clean the bank/brand name to fetch corporate logo from logo.dev accurately
  let searchName = name.trim();
  if (n === "sbi") searchName = "State Bank of India";
  else if (n === "idfc") searchName = "IDFC First Bank";
  else if (n === "hdfc") searchName = "HDFC Bank";
  else if (n === "icici") searchName = "ICICI Bank";
  else if (n === "axis") searchName = "Axis Bank";
  else if (n === "kotak") searchName = "Kotak Mahindra Bank";
  else if (n === "pnb") searchName = "Punjab National Bank";
  else if (n === "bob") searchName = "Bank of Baroda";
  else if (n === "canara") searchName = "Canara Bank";
  else if (n === "blinkit") searchName = "Blinkit";
  else if (n === "instamart") searchName = "Swiggy Instamart";
  else if (n.includes("smart bazar") || n.includes("smart bazaar")) searchName = "Smart Bazaar";
  else if (n === "zepto") searchName = "Zepto";
  else if (n === "swiggy") searchName = "Swiggy";
  else if (n === "zomato") searchName = "Zomato";
  else if (n === "bigbasket") searchName = "BigBasket";

  const logoUrl = `https://img.logo.dev/name/${encodeURIComponent(searchName)}?token=pk_bULVxR0LQ8q2w7CFMO1Ajg&size=${size}&format=webp&retina=true`;

  return (
    <img
      src={logoUrl}
      alt={name}
      className={`${className || "w-4 h-4"} object-contain flex-shrink-0`}
      onError={() => setHasError(true)}
    />
  );
}
