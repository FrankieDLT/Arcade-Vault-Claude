"use client";

import { useCallback, useEffect, useState } from "react";
import { PinAlmanac } from "@/components/pin-almanac";
import { PinMachine } from "@/components/pin-machine";
import { useSession } from "@/components/session-provider";
import { fetchOwnedPins } from "@/lib/pins-db";
import { PINS } from "@/lib/pins/catalog";

export type OwnedStatus = "loading" | "ready" | "error";

/** /pins: the machine on top, the almanac below. Owns the set of obtained pins. */
export function PinCollection() {
  const { user, status: sessionStatus } = useSession();
  const signedIn = user !== null;
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  const [ownedStatus, setOwnedStatus] = useState<OwnedStatus>("loading");

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!signedIn) {
      // Guest: every pin stays a silhouette.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOwned(new Set());
      setOwnedStatus("ready");
      return;
    }
    let cancelled = false;
    setOwnedStatus("loading");
    fetchOwnedPins()
      .then((ids) => {
        if (cancelled) return;
        setOwned(new Set(ids));
        setOwnedStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setOwnedStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, sessionStatus]);

  const addOwned = useCallback((pinId: string) => {
    setOwned((prev) => new Set(prev).add(pinId));
  }, []);

  return (
    <div className="av-pins fade-in">
      <div className="pins-head">
        <h1>PIN COLLECTION</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          TRADE CREDITS FOR PINS. FILL THE ALMANAC.
        </p>
      </div>

      <PinMachine
        signedIn={signedIn}
        sessionLoading={sessionStatus === "loading"}
        ownedCount={owned.size}
        total={PINS.length}
        onObtained={addOwned}
      />

      <PinAlmanac owned={owned} status={ownedStatus} total={PINS.length} />
    </div>
  );
}
