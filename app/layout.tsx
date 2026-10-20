import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountProvider } from "@/components/providers/account-provider";
import { ServiceWorker } from "@/components/providers/service-worker";
import "./globals.css";

// A tight geometric grotesk: bold, confident headlines and figures.
const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-app", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Sudoku", template: "%s · Sudoku" },
  description: "A calm, precise Sudoku. Classic puzzles, a daily challenge and private rooms with friends.",
  applicationName: "Sudoku",
  appleWebApp: {
    capable: true,
    title: "Sudoku",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // Icons come from app/icon.svg (favicon) and app/apple-icon.png (iOS).
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full ${sans.variable}`}>
      <body className="min-h-dvh">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={400}>
            <AccountProvider>{children}</AccountProvider>
          </TooltipProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
