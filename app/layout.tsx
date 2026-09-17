import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Canonical origin for absolute SEO URLs. NEXT_PUBLIC_APP_URL must be the
// public production origin in deployed environments.
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GATE Mentor — Practice GATE CS/IT PYQs with an AI Tutor",
    template: "%s · GATE Mentor",
  },
  description:
    "Crack GATE Computer Science: practice previous-year questions by subject, topic, year, and difficulty with server-validated attempts, accuracy analytics, and a Mentor that explains every miss step by step.",
  keywords: [
    "GATE CS",
    "GATE CSE",
    "GATE Computer Science preparation",
    "GATE IT preparation",
    "GATE previous year questions",
    "GATE PYQ practice",
    "GATE question bank",
    "GATE mock practice",
    "operating systems GATE",
    "algorithms GATE",
    "DBMS GATE",
    "computer networks GATE",
    "theory of computation GATE",
  ],
  authors: [{ name: "GATE Mentor" }],
  creator: "GATE Mentor",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "GATE Mentor",
    title: "GATE Mentor — Practice GATE CS/IT PYQs with an AI Tutor",
    description:
      "Previous-year GATE CS questions, step-by-step Mentor explanations, and accuracy analytics built from your real attempts.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GATE Mentor — Practice GATE CS/IT PYQs with an AI Tutor",
    description:
      "Previous-year GATE CS questions, step-by-step Mentor explanations, and accuracy analytics built from your real attempts.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
