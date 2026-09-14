"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

const INTERVAL_MS = 5000;
const LEASE_MS = 4000;
const LEASE_KEY = "caddysoft:worker-lease";

function tryAcquireLease() {
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(LEASE_KEY);
    if (raw) {
      const expiresAt = Number(raw);
      if (Number.isFinite(expiresAt) && expiresAt > now) return false;
    }
    window.localStorage.setItem(LEASE_KEY, String(now + LEASE_MS));
    const confirmed = Number(window.localStorage.getItem(LEASE_KEY));
    return confirmed > now;
  } catch {
    return true;
  }
}

export function WorkerHeartbeat() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      if (stopped || document.visibilityState === "hidden" || !tryAcquireLease()) return;
      try {
        await fetch("/api/worker/tick", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          cache: "no-store",
        });
      } catch {
        // The next heartbeat retries; worker state remains durable in the database.
      }
    };

    void tick();
    timer = setInterval(() => void tick(), INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
