"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGameDefinition } from "@/components/game-registry";
import { useSession } from "@/components/session-provider";
import type { TetrisTheme } from "@/lib/tetris/constants";
import { useBackgroundMusic } from "@/components/use-background-music";
import { useSoundEffects } from "@/components/use-sound-effects";
import { insertScore } from "@/lib/scores-db";

const LEVEL_STEP = 2500;

export function GamePlayer({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const { user } = useSession();
  // Games with a real engine are in the registry; every other game keeps the fake simulation.
  const definition = getGameDefinition(gameId);
  const Canvas = definition?.Canvas;
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [lines, setLines] = useState(0);
  const [engineLevel, setEngineLevel] = useState(1);
  // runId remounts the canvas on PLAY AGAIN; endSignal asks it to end the run.
  const [runId, setRunId] = useState(0);
  const [endSignal, setEndSignal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // In memory only: resets on reload, kept by PLAY AGAIN.
  const [muted, setMuted] = useState(false);
  // Canvas look: in memory only, kept by PLAY AGAIN, reset on reload.
  const [skin, setSkin] = useState<string>(
    definition?.appearance?.skins[0]?.id ?? "retro",
  );
  const [theme, setTheme] = useState<TetrisTheme>("dark");
  // Level select (PAUSED overlay): a new `id` asks the engine to jump to `level`.
  const [levelRequest, setLevelRequest] = useState<
    { level: number; id: number } | undefined
  >(undefined);
  const appearance = definition?.appearance;
  const levelSelect = definition?.levelSelect;
  const skinLabel =
    appearance?.skins.find((s) => s.id === skin)?.label ?? skin.toUpperCase();
  // null until the player edits it, so the session name (loaded after mount) is used.
  const [editedName, setEditedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const name = editedName ?? user?.name ?? "GUEST";
  const level = definition?.stats.level
    ? engineLevel
    : 1 + Math.floor(score / LEVEL_STEP);

  useBackgroundMusic(definition?.music, {
    active: !!definition?.music && !paused && !over,
    muted,
    restartKey: runId,
  });

  const playSound = useSoundEffects(definition?.sfx, { muted });

  const changeLevel = (
    delta: number,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!levelSelect) return;
    const next = Math.min(
      levelSelect.max,
      Math.max(levelSelect.min, engineLevel + delta),
    );
    setLevelRequest((prev) => ({ level: next, id: (prev?.id ?? 0) + 1 }));
    // Keep Space (launch) from re-clicking the button.
    e.currentTarget.blur();
  };

  useEffect(() => {
    if (definition || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [definition, over, paused]);

  const endRun = () => {
    if (definition) setEndSignal((n) => n + 1);
    else setOver(true);
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setLines(0);
    setEngineLevel(1);
    setLevelRequest(undefined);
    setEndSignal(0);
    setRunId((n) => n + 1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(false);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await insertScore({ gameId, name, score });
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Player</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Score</div>
            <div className="v">{score.toLocaleString("en-US")}</div>
          </div>
          {definition?.stats.lines ? (
            <div className="hud-stat lines">
              <div className="l">{definition.linesLabel ?? "Lines"}</div>
              <div className="v">{lines.toLocaleString("en-US")}</div>
            </div>
          ) : (
            <div className="hud-stat lives">
              <div className="l">Lives</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          {definition?.stats.level !== false && (
            <div className="hud-stat level">
              <div className="l">Level</div>
              <div className="v">{String(level).padStart(2, "0")}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button className="btn magenta" onClick={endRun}>
            END
          </button>
          {(definition?.music || definition?.sfx) && (
            <button
              className="btn"
              aria-pressed={muted}
              onClick={(e) => {
                setMuted((m) => !m);
                // Keep Space (hard drop, launch) from re-clicking the button.
                e.currentTarget.blur();
              }}
            >
              {definition.music ? "MUSIC" : "SOUND"} {muted ? "OFF" : "ON"}
            </button>
          )}
          <Link href={`/games/${gameId}`} className="btn ghost">
            EXIT
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {Canvas && definition ? (
            <Canvas
              key={runId}
              paused={paused}
              endSignal={endSignal}
              onScore={setScore}
              onLives={definition.stats.lives ? setLives : undefined}
              onLines={definition.stats.lines ? setLines : undefined}
              onLevel={definition.stats.level ? setEngineLevel : undefined}
              skin={appearance ? skin : undefined}
              theme={appearance?.themes ? theme : undefined}
              onSound={definition.sfx ? playSound : undefined}
              levelRequest={levelSelect ? levelRequest : undefined}
              onGameOver={(finalScore) => {
                setScore(finalScore);
                setOver(true);
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  PAUSED
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PRESS RESUME TO CONTINUE
                </div>
                {levelSelect && (
                  <div className="level-select">
                    <div className="ls-row">
                      <button
                        className="btn ghost"
                        aria-label="Previous level"
                        disabled={engineLevel <= levelSelect.min}
                        onClick={(e) => changeLevel(-1, e)}
                      >
                        −
                      </button>
                      <div>
                        <div className="ls-label">LEVEL</div>
                        <div className="ls-value" aria-live="polite">
                          {String(engineLevel).padStart(2, "0")}
                        </div>
                      </div>
                      <button
                        className="btn ghost"
                        aria-label="Next level"
                        disabled={engineLevel >= levelSelect.max}
                        onClick={(e) => changeLevel(1, e)}
                      >
                        +
                      </button>
                    </div>
                    <p className="ls-note">
                      CHANGING LEVEL RESTARTS THE WALL (SCORE AND LIVES KEPT)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SIGNAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>LOAD · 1MB</span>
        </div>
      </div>

      {appearance && (
        <div className="appearance-row">
          {appearance.skins.length > 1 && (
            <button
              className="btn ghost"
              onClick={(e) => {
                const i = appearance.skins.findIndex((s) => s.id === skin);
                setSkin(appearance.skins[(i + 1) % appearance.skins.length].id);
                // Keep Space (hard drop) from re-clicking the button.
                e.currentTarget.blur();
              }}
            >
              SKIN: {skinLabel}
            </button>
          )}
          {appearance.themes && (
            <button
              className="btn ghost"
              onClick={(e) => {
                setTheme((t) => (t === "dark" ? "light" : "dark"));
                e.currentTarget.blur();
              }}
            >
              THEME: {theme.toUpperCase()}
            </button>
          )}
        </div>
      )}

      {definition && (
        <p className="controls-hint">
          {definition.controls.map((c) => (
            <span key={`${c.label}:${c.keys.join("+")}`}>
              {c.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}{" "}
              {c.label}
            </span>
          ))}
        </p>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{score.toLocaleString("en-US")}</div>
            {!saved ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) =>
                      setEditedName(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="YOUR INITIALS"
                    aria-label="Your name"
                  />
                  <button
                    className="btn yellow"
                    onClick={save}
                    disabled={saving}
                  >
                    SAVE SCORE
                  </button>
                </div>
                {saveError && (
                  <p className="toast-error" role="alert">
                    COULD NOT SAVE SCORE. TRY AGAIN.
                  </p>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ SCORE SAVED_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                PLAY AGAIN
              </button>
              <Link href="/library" className="btn magenta">
                BACK TO THE VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
