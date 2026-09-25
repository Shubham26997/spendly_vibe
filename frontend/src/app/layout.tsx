import type { Metadata } from "next";
import "./globals.css";
import ClientShell from "./components/ClientShell";
import { AuthProvider } from "./context/AuthContext";

export const metadata: Metadata = {
  title: "Spendly",
  description: "Personal expense tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-gray-50 dark:bg-gray-950 min-h-screen font-sans transition-colors duration-200">
        <AuthProvider>
          <ClientShell />
          <div className="pt-14">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
