import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/noc/queries";
import { runRuijieSync, pollRuijieDeviceStatus, type RuijieSyncResult } from "./ruijie-sync";

const STORAGE_KEY = "noc.ruijie.scheduler";
const LAST_RUN_KEY = "noc.ruijie.lastRun";

export type ScheduleInterval = 0 | 5 | 15 | 30 | 60; // minutes; 0 = off

interface SchedulerState {
  intervalMin: ScheduleInterval;
  enabled: boolean;
}

function readState(): SchedulerState {
  if (typeof window === "undefined") return { intervalMin: 15, enabled: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { intervalMin: 15, enabled: false };
    return JSON.parse(raw) as SchedulerState;
  } catch {
    return { intervalMin: 15, enabled: false };
  }
}
function writeState(s: SchedulerState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
function readLastRun(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_RUN_KEY);
}
function writeLastRun(at: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_RUN_KEY, at);
}

export function useRuijieScheduler() {
  const qc = useQueryClient();
  const [state, setState] = useState<SchedulerState>(() => readState());
  const [lastRun, setLastRun] = useState<string | null>(() => readLastRun());
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<RuijieSyncResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runNow = useCallback(async (mode: "full" | "poll" = "full") => {
    if (running) return;
    setRunning(true);
    try {
      if (mode === "full") {
        const result = await runRuijieSync();
        setLastResult(result);
        setLastRun(result.at);
        writeLastRun(result.at);
      } else {
        const r = await pollRuijieDeviceStatus();
        setLastRun(r.at);
        writeLastRun(r.at);
      }
      qc.invalidateQueries({ queryKey: qk.schools });
    } finally {
      setRunning(false);
    }
  }, [qc, running]);

  // Schedule loop
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!state.enabled || state.intervalMin === 0) return;
    const ms = state.intervalMin * 60_000;
    timerRef.current = setInterval(() => {
      runNow("poll").catch(() => {});
    }, ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.enabled, state.intervalMin, runNow]);

  function setInterval_(intervalMin: ScheduleInterval) {
    const next = { ...state, intervalMin };
    setState(next);
    writeState(next);
  }
  function setEnabled(enabled: boolean) {
    const next = { ...state, enabled };
    setState(next);
    writeState(next);
  }

  return {
    intervalMin: state.intervalMin,
    enabled: state.enabled,
    lastRun,
    lastResult,
    running,
    runNow,
    setInterval: setInterval_,
    setEnabled,
  };
}