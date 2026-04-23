import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MiniKitProvider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vohu — encrypted votes for verified humans",
  description:
    "Privacy-preserving voting Mini App. Passkeys guard the front door. hyde guards the ballot box.",
  openGraph: {
    title: "vohu — encrypted votes for verified humans",
    description:
      "Privacy-preserving voting Mini App. Secret ballot + verified human, all in one tap.",
    url: "https://vohu.vercel.app",
    siteName: "vohu",
    images: [
      {
        url: "/og-image.png",
        width: 1400,
        height: 980,
        alt: "vohu — encrypted votes for verified humans",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "vohu — encrypted votes for verified humans",
    description:
      "Privacy-preserving voting Mini App. Secret ballot + verified human, all in one tap.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MiniKitProvider>{children}</MiniKitProvider>
      </body>
    </html>
  );
}
