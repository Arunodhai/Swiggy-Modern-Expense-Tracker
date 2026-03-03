import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swiggy Spending Dashboard",
  description: "Next.js migration shell for the Swiggy spending dashboard."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("swiggy_theme_v1")?.value;
  const resolvedTheme = cookieTheme === "light" ? "light" : "dark";

  return (
    <html lang="en" data-theme={resolvedTheme} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const theme = localStorage.getItem("swiggy_theme_v1");
              const resolved = theme === "light" ? "light" : "dark";
              document.documentElement.dataset.theme = resolved;
              if (document.body) {
                document.body.dataset.theme = resolved;
              }
            } catch (_) {}
          })();`}
        </Script>
      </head>
      <body data-theme={resolvedTheme}>{children}</body>
    </html>
  );
}
