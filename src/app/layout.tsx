import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Comskills Circle", template: "%s · Comskills Circle" },
  description: "The private community of the Comskills Fellowship: pitch projects, find teammates, track scholarships and share opportunities.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1530" },
    { media: "(prefers-color-scheme: light)", color: "#f3f4fa" },
  ],
};

// Applies the saved theme before paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('circle-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-tz={process.env.APP_TIME_ZONE || "Asia/Karachi"} suppressHydrationWarning className={GeistSans.variable}>
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
