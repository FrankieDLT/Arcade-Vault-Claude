import type { Metadata } from "next";
import {
  Press_Start_2P,
  JetBrains_Mono,
  Courier_Prime,
} from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { GamepadProvider } from "@/components/gamepad-provider";
import { Nav } from "@/components/nav";
import { SessionProvider } from "@/components/session-provider";

const pressStart = Press_Start_2P({
  variable: "--f-pressstart",
  weight: "400",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const courier = Courier_Prime({
  variable: "--font-courier",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Arcade Vault", template: "%s | Arcade Vault" },
  description: "Play games and compete for the highest score.",
  referrer: "strict-origin-when-cross-origin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${jetbrains.variable} ${courier.variable}`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <div className="av-app">
          <SessionProvider>
            <GamepadProvider>
              <Nav />
              <main className="av-main">{children}</main>
              <Footer />
            </GamepadProvider>
          </SessionProvider>
        </div>
      </body>
    </html>
  );
}
