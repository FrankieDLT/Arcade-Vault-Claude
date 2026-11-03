import {
  HighlightIcon,
  type HighlightKind,
} from "./about/highlight-icon";
import { ContactForm } from "./contact-form";
import { RevealObserver } from "./reveal-observer";

const HIGHLIGHTS: { icon: HighlightKind; text: string; color: string }[] = [
  { icon: "HEART", text: "MADE WITH ❤️ FOR PLAYERS", color: "magenta" },
  { icon: "BROWSER", text: "HTML GAMES — RUN IN ANY BROWSER", color: "cyan" },
  { icon: "PLANT", text: "A PROJECT THAT KEEPS GROWING", color: "green" },
];

const TIPS = [
  { text: "REPLY WITHIN 24-48H", led: "" },
  { text: "SUGGESTIONS WELCOME", led: " y" },
  { text: "NO SPAM, EVER", led: " m" },
];

export function About() {
  return (
    <div className="about fade-in">
      <RevealObserver />

      {/* ABOUT */}
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ABOUT</div>
        <h1 className="about-title">ABOUT ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT was born from a love of classic video games. Our mission
          is to preserve and celebrate the arcades that defined a generation,
          making them accessible to everyone, anywhere, at no cost.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.icon}
              className={"highlight " + h.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <HighlightIcon kind={h.icon} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divider banner */}
      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      {/* CONTACT */}
      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACT</div>
            <h2 className="contact-title">GET IN TOUCH</h2>
            <p className="contact-sub">
              Got a suggestion, want to propose a game, or just want to say
              hi? Write to us.
            </p>
            <div className="contact-tips">
              {TIPS.map((t) => (
                <div key={t.text} className="tip">
                  <span className={"tip-led" + t.led}></span>
                  {t.text}
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </div>
  );
}
