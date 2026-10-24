import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Compass", template: "%s · Compass" },
  description: "Share internships and opportunities within the M1 AIRE class, get matched automatically, and see where everyone is heading.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1530" },
    { media: "(prefers-color-scheme: light)", color: "#f3f4fa" },
  ],
};

// Applies the saved theme before paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('compass-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={GeistSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="sky min-h-dvh">
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: "var(--raised-2)", color: "var(--star)", border: "1px solid var(--line-strong)" },
          }}
        />
      </body>
    </html>
  );
}
