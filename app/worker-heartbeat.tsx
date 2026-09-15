"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

const HEARTBEAT_MS = 5_000;
const LEASE_KEY = "caddysoft-worker-heartbeat-lease";
const LEASE_MS = 4_000;

function acquireLease() {
  const now = Date.now();
  try {
    const current = Number(window.localStorage.getItem(LEASE_KEY) ?? "0");
    if (Number.isFinite(current) && current > now) return false;
    window.localStorage.setItem(LEASE_KEY, String(now + LEASE_MS));
    return true;
  } catch {
    return true;
  }
}

export function WorkerHeartbeat() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let stopped = false;

    const tick = async () => {
      if (stopped || document.visibilityState !== "visible" || !acquireLease()) return;
      try {
        await fetch("/api/worker/tick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch {
        // A missed heartbeat is safe: jobs remain durable in the database.
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void tick();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
