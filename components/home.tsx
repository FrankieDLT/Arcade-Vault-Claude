import Link from "next/link";
import { GAMES } from "@/lib/games";
import {
  FAQ,
  FEATURES,
  HOME_STATS,
  PRICING_FEATURES,
} from "@/lib/home";
import { FeatureIcon } from "./home/feature-icon";
import { FloatingSilhouettes } from "./home/floating-silhouettes";
import { LiveActivity } from "./home/live-activity";
import { MiniCard } from "./home/mini-card";
import { RevealObserver } from "./reveal-observer";


export function Home() {
  return (
    <div className="home fade-in">
      <RevealObserver />
      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERT A COIN<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">THE CLASSIC</span>
            <span className="line-2">ARCADE IS</span>
            <span className="line-3">BACK</span>
          </h1>
          <p className="home-sub">
            Play the best classics right in your browser.
            <br />
            No downloads. No cost. Just fun.
          </p>
          <div className="home-ctas">
            <Link href="/library" className="btn xl pulse">
              ▶ EXPLORE GAMES
            </Link>
            <Link href="/auth" className="btn xl magenta">
              ✦ CREATE ACCOUNT
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>SCROLL</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">WHY ARCADE VAULT?</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.icon}
              className={"feature-card " + f.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <FeatureIcon kind={f.icon} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMES PREVIEW */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">GAMES AVAILABLE NOW</h2>
          <div className="section-rule"></div>
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/library" className="btn lg">
            VIEW ALL GAMES →
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {HOME_STATS.map((st, i) => (
            <div
              key={st.value}
              className="stat-block"
              style={{ transitionDelay: i * 90 + "ms" }}
            >
              <div className="stat-n neon-yellow">{st.value}</div>
              <div className="stat-u pixel">{st.unit}</div>
              <div className="stat-s">{st.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE ACTIVITY */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">LIVE ACTIVITY</h2>
          <div className="section-rule"></div>
        </div>
        <LiveActivity />
      </section>

      {/* PRICING */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRICING</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">ONE SIMPLE PLAN</div>
            <div className="pc-name pixel">VAULT PLAYER</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ FOREVER</span>
            </div>
            <div className="pc-tag">NO TRICKS · NO FINE PRINT</div>
            <ul className="pc-list">
              {PRICING_FEATURES.map((f) => (
                <li key={f}>✔ {f}</li>
              ))}
            </ul>
            <Link href="/auth" className="btn xl pulse" style={{ width: "100%" }}>
              START FREE →
            </Link>
            <div className="pc-foot">We don&apos;t ask for a card. We never will.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQ.map((item) => (
              <div key={item.q} className="faq-item">
                <div className="faq-q pixel">{item.q}</div>
                <div className="faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">READY TO PLAY?</h2>
        <Link href="/library" className="btn xl pulse final-cta">
          INSERT COIN →
        </Link>
        <div className="final-tag">Free. No sign-up required. Start in seconds.</div>
      </section>
    </div>
  );
}
