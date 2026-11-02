import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="fade-in"
      style={{ textAlign: "center", padding: "120px 24px", color: "var(--ink-dim)" }}
    >
      <h1
        className="pixel neon-magenta flicker"
        style={{ fontSize: 48, marginBottom: 20 }}
      >
        404
      </h1>
      <div className="pixel neon-cyan" style={{ fontSize: 14, marginBottom: 14 }}>
        GAME NOT FOUND
      </div>
      <p style={{ marginBottom: 32 }}>
        This cartridge isn&apos;t in the vault. Check the address or pick a game
        from the library.
      </p>
      <Link href="/" className="btn lg">
        BACK TO THE LIBRARY
      </Link>
    </div>
  );
}
