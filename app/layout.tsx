import type { Metadata } from "next";
import { Fraunces, Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { IdentifyUser } from "@/components/identify-user";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-schibsted-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LLM Arena",
  description:
    "Send one prompt, watch up to three AI models answer at once, vote for the best one.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${fraunces.variable} ${schibstedGrotesk.variable} ${plexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {/* Light is the default the app is designed around — the warm
              parchment paper, not the OS's guess. Dark stays a real choice a
              person makes with the toggle in the sidebar. */}
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <IdentifyUser />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
