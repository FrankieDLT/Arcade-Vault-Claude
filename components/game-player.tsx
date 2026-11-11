"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCredits } from "@/components/credits-provider";
import { getGameDefinition } from "@/components/game-registry";
import { useGamepad } from "@/components/gamepad-provider";
import { useSession } from "@/components/session-provider";
import { TouchPad } from "@/components/touch-pad";
import { useTouchUi } from "@/components/use-touch-ui";
import type { TetrisTheme } from "@/lib/tetris/constants";
import { useBackgroundMusic } from "@/components/use-background-music";
import { useSoundEffects } from "@/components/use-sound-effects";
import {
  canVibrate,
  haptic,
  HAPTIC_PATTERNS,
  type HapticKind,
} from "@/lib/haptics";
import { rememberNextPath } from "@/lib/auth-redirect";
import { awardCredit } from "@/lib/pins-db";
import {
  insertScore,
  ScoreSaveError,
  type ScoreSaveFailure,
} from "@/lib/scores-db";

const SAVE_FAILURE_TEXT: Record<ScoreSaveFailure, string> = {
  banned: "THIS ACCOUNT CANNOT SAVE SCORES.",
  signin: "SIGN IN TO SAVE YOUR SCORE.",
  other: "COULD NOT SAVE SCORE. TRY AGAIN.",
};

const LEVEL_STEP = 2500;

const getNoTouchUi = () => false;
const subscribeNever = () => () => {};

export function GamePlayer({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const { user, status } = useSession();
  const { setBalance } = useCredits();
  const pathname = usePathname();
  // Every catalog game has a real engine registered in game-registry.
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
  // Games with `modes` start on a mode picker (mode = null); the mode is fixed per run.
  const [mode, setMode] = useState<string | null>(
    definition?.modes ? null : "default",
  );
  // PvE difficulty (PAUSED overlay): in memory only, kept by PLAY AGAIN.
  const [difficulty, setDifficulty] = useState<string | undefined>(
    definition?.difficultySelect?.default,
  );
  const choosingMode = mode === null;
  // Canvas look: in memory only, kept by PLAY AGAIN, reset on reload.
  const [skin, setSkin] = useState<string>(
    definition?.appearance?.skins[0]?.id ?? "retro",
  );
  const [theme, setTheme] = useState<TetrisTheme>("dark");
  // Haptics: in memory only, independent of mute, kept by PLAY AGAIN, reset on reload.
  const [hapticsOn, setHapticsOn] = useState(true);
  const touchUi = useTouchUi();
  const { enabled: padEnabled, skin: padSkin } = useGamepad();
  const vibrateSupported = useSyncExternalStore(
    subscribeNever,
    canVibrate,
    getNoTouchUi,
  );
  const showHapticsToggle = !!definition && touchUi && vibrateSupported;
  const fireHaptic = (kind: HapticKind) => {
    if (showHapticsToggle && hapticsOn) haptic(kind);
  };
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
  const [saveFailure, setSaveFailure] = useState<ScoreSaveFailure | null>(null);
  // SPEC 18: +1 credit at Game Over, asked once per run. The server decides (score > 0, ban, cooldown).
  const [creditsEarned, setCreditsEarned] = useState(0);
  const awardedRun = useRef<number | null>(null);
  // Active play time of the run in ms: not while paused, over, hidden or on the mode picker.
  const playedMs = useRef(0);
  const runActive = !paused && !over && (!definition?.modes || mode !== null);
  const signedIn = user !== null;

  // scores.name holds at most 10 chars, a username up to 20.
  const name = editedName ?? user?.name.slice(0, 10) ?? "GUEST";
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

  // Counts play time. Its cleanup runs before the award effect below in the same commit, so the
  // last slice is already added when the run ends.
  useEffect(() => {
    if (!runActive) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (document.visibilityState === "visible")
        playedMs.current += now - last;
      last = now;
    };
    const id = setInterval(tick, 250);
    return () => {
      tick();
      clearInterval(id);
    };
  }, [runActive, runId]);

  useEffect(() => {
    if (!over || !signedIn || score <= 0 || awardedRun.current === runId)
      return;
    awardedRun.current = runId;
    awardCredit(gameId, score, Math.floor(playedMs.current / 1000))
      .then((result) => {
        setBalance(result.balance);
        if (result.awarded) setCreditsEarned(result.credits);
      })
      .catch(() => {
        // A failed award shows nothing and never blocks SAVE SCORE or PLAY AGAIN.
      });
  }, [over, signedIn, score, runId, gameId, setBalance]);

  const endRun = () => {
    setEndSignal((n) => n + 1);
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
    setSaveFailure(null);
    setCreditsEarned(0);
    playedMs.current = 0;
  };

  const pickMode = (id: string) => {
    restart();
    setMode(id);
  };

  const changeMode = () => {
    restart();
    setMode(null);
  };

  const difficultySelect = definition?.difficultySelect;
  const showDifficulty =
    !!difficultySelect &&
    mode !== null &&
    difficultySelect.onlyModes.includes(mode);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveFailure(null);
    try {
      await insertScore({ gameId, name, score });
      setSaved(true);
    } catch (err) {
      setSaveFailure(err instanceof ScoreSaveError ? err.kind : "other");
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
          ) : definition && !definition.stats.lives ? null : (
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
          <button
            className="btn yellow"
            disabled={choosingMode}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button
            className="btn magenta"
            disabled={choosingMode}
            onClick={endRun}
          >
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
          {choosingMode && definition?.modes ? (
            <div className="crt-content">
              <div className="mode-picker">
                <div className="pixel neon-yellow" style={{ fontSize: 18 }}>
                  CHOOSE A MODE
                </div>
                <div className="mode-options">
                  {definition.modes.map((m, i) => (
                    <button
                      key={m.id}
                      className={`mode-btn ${i === 0 ? "cyan" : "magenta"}`}
                      onClick={(e) => {
                        pickMode(m.id);
                        // Keep Space from re-clicking the button.
                        e.currentTarget.blur();
                      }}
                    >
                      <span className="mode-name">{m.label}</span>
                      <span className="mode-hint">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : Canvas && definition ? (
            <Canvas
              key={runId}
              mode={definition.modes ? (mode ?? undefined) : undefined}
              difficulty={difficultySelect ? difficulty : undefined}
              paused={paused}
              endSignal={endSignal}
              onScore={setScore}
              onLives={definition.stats.lives ? setLives : undefined}
              onLines={definition.stats.lines ? setLines : undefined}
              onLevel={definition.stats.level ? setEngineLevel : undefined}
              skin={appearance ? skin : undefined}
              theme={appearance?.themes ? theme : undefined}
              onSound={
                definition.sfx
                  ? (sound) => {
                      playSound(sound);
                      // Arkanoid: a broken brick also vibrates; bounces do not.
                      if (sound === "brick") fireHaptic("brick");
                    }
                  : undefined
              }
              onHaptic={(name) => {
                if (Object.hasOwn(HAPTIC_PATTERNS, name))
                  fireHaptic(name as HapticKind);
              }}
              levelRequest={levelSelect ? levelRequest : undefined}
              onGameOver={(finalScore) => {
                setScore(finalScore);
                setOver(true);
                fireHaptic("gameover");
              }}
            />
          ) : null}
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
                {showDifficulty && difficultySelect && (
                  <div className="level-select opt-select">
                    <div className="ls-label">CPU DIFFICULTY</div>
                    <div
                      className="ls-row"
                      role="group"
                      aria-label="CPU difficulty"
                    >
                      {difficultySelect.options.map((o) => (
                        <button
                          key={o.id}
                          className="btn ghost ls-opt"
                          aria-pressed={difficulty === o.id}
                          onClick={(e) => {
                            setDifficulty(o.id);
                            e.currentTarget.blur();
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <p className="ls-note">
                      CHANGING DIFFICULTY RESTARTS THE MATCH. SCORE X0.75 · X1 ·
                      X1.5
                    </p>
                  </div>
                )}
                {definition?.sfx?.pauseToggle && (
                  <div className="level-select opt-select">
                    <button
                      className="btn ghost ls-opt"
                      aria-pressed={muted}
                      onClick={(e) => {
                        setMuted((m) => !m);
                        e.currentTarget.blur();
                      }}
                    >
                      SOUND {muted ? "OFF" : "ON"}
                    </button>
                  </div>
                )}
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

      {definition?.touch?.pad && (touchUi || padEnabled) && (
        <TouchPad
          buttons={definition.touch.pad}
          skin={padSkin}
          disabled={paused || over || choosingMode}
          onPress={() => fireHaptic("tap")}
        />
      )}

      {(appearance || showHapticsToggle) && (
        <div className="appearance-row">
          {appearance && appearance.skins.length > 1 && (
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
          {appearance?.themes && (
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
          {showHapticsToggle && (
            <button
              className="btn ghost"
              aria-pressed={hapticsOn}
              onClick={(e) => {
                setHapticsOn((h) => !h);
                e.currentTarget.blur();
              }}
            >
              HAPTICS {hapticsOn ? "ON" : "OFF"}
            </button>
          )}
        </div>
      )}

      {definition && (
        <>
          <p
            className={`controls-hint${definition.touch ? " controls-hint-keys" : ""}`}
          >
            {definition.controls.map((c) => (
              <span key={`${c.label}:${c.keys.join("+")}`}>
                {c.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}{" "}
                {c.label}
              </span>
            ))}
          </p>
          {definition.touch && (
            <p className="controls-hint controls-hint-touch">
              {definition.touch.hint.map((c) => (
                <span key={`${c.label}:${c.keys.join("+")}`}>
                  {c.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}{" "}
                  {c.label}
                </span>
              ))}
            </p>
          )}
        </>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">FINAL SCORE</div>
            <div className="final">{score.toLocaleString("en-US")}</div>
            {creditsEarned > 0 && (
              <div className="credit-earned" role="status">
                +{creditsEarned} {creditsEarned === 1 ? "CREDIT" : "CREDITS"}
              </div>
            )}
            {saved ? (
              <div className="toast-saved">▸ SCORE SAVED_</div>
            ) : status === "loading" ? null : !user ? (
              // Only signed-in users can save scores (SPEC 13).
              <div className="signin-prompt">
                <p className="toast-error">SIGN IN TO SAVE YOUR SCORE</p>
                <Link
                  href="/auth"
                  className="btn yellow"
                  onClick={() => rememberNextPath(pathname)}
                >
                  SIGN IN
                </Link>
              </div>
            ) : (
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
                {saveFailure && (
                  <p className="toast-error" role="alert">
                    {SAVE_FAILURE_TEXT[saveFailure]}
                  </p>
                )}
              </>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                PLAY AGAIN
              </button>
              {definition?.modes && (
                <button className="btn yellow" onClick={changeMode}>
                  CHANGE MODE
                </button>
              )}
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
