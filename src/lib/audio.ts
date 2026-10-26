"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, PickingRequest } from "@/lib/types";

export type SoundPreferences = { enabled: boolean; sound: string; volume: number; repeat: number; maxDuration: number };
function audioContext() {
  const BrowserAudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!BrowserAudioContext) throw new Error("Audio is unavailable in this browser. Use current Chrome or Edge.");
  return new BrowserAudioContext();
}
export function playTone(context: AudioContext, sound: string, volume: number) {
  const frequencies = sound === "bell" ? [880, 1318, 1760] : sound === "pulse" ? [740, 740] : [659.25, 880];
  const nodes: OscillatorNode[] = [];
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * .19;
    oscillator.type = "sine"; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(Math.max(0, volume / 100) * .24, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .32);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + .34);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    nodes.push(oscillator);
  });
  return () => { nodes.forEach((node) => { try { node.stop(); } catch {} }); };
}
export async function previewSound(sound: string, volume: number) {
  const context = audioContext();
  await context.resume();
  if (context.state !== "running") { await context.close(); throw new Error("Audio was blocked. Check this browser’s sound permissions."); }
  playTone(context, sound, volume);
  setTimeout(() => void context.close(), 1300);
}
export function useWarehouseAudio(settings: AppSettings, requests: PickingRequest[], now: number, connected: boolean) {
  const [local, setLocal] = useState<SoundPreferences | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [audioError, setAudioError] = useState("");
  const context = useRef<AudioContext | null>(null);
  const stopCurrent = useRef<(() => void) | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("picklane-display-sound");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.enabled === "boolean" && ["chime", "bell", "pulse"].includes(parsed.sound) && Number.isFinite(parsed.volume) && parsed.volume >= 0 && parsed.volume <= 100 && Number.isFinite(parsed.repeat) && parsed.repeat >= 3 && parsed.repeat <= 120 && Number.isFinite(parsed.maxDuration) && parsed.maxDuration >= 0 && parsed.maxDuration <= 86400) setLocal(parsed);
      }
    } catch {}
    return () => { stopCurrent.current?.(); void context.current?.close(); };
  }, []);
  const preferences = useMemo<SoundPreferences>(() => local || { enabled: settings.soundEnabled, sound: settings.alertSound, volume: settings.volume, repeat: settings.repeatInterval, maxDuration: settings.maxAlertDuration }, [local, settings]);
  const setPreferences = useCallback((prefs: SoundPreferences) => { setLocal(prefs); try { localStorage.setItem("picklane-display-sound", JSON.stringify(prefs)); } catch {} }, []);
  const resetPreferences = useCallback(() => { setLocal(null); try { localStorage.removeItem("picklane-display-sound"); } catch {} }, []);
  const newOrders = requests.filter((request) => request.status === "NEW");
  const timedOut = new Set(newOrders.filter((r) => preferences.maxDuration > 0 && now - new Date(r.createdAt).getTime() >= preferences.maxDuration * 1000).map((r) => r.id));
  const eligibleIds = newOrders.filter((r) => !timedOut.has(r.id)).map((r) => r.id).sort().join(",");
  const enable = useCallback(async () => {
    try {
      if (!context.current || context.current.state === "closed") {
        context.current = audioContext();
        context.current.onstatechange = () => {
          const running = context.current?.state === "running";
          setUnlocked(running);
          if (!running && context.current?.state !== "closed") setAudioError("Browser audio is paused. Enable sound again to resume alerts.");
        };
      }
      await context.current.resume();
      if (context.current.state !== "running") throw new Error("The browser blocked audio. Allow sound for this site, then try again.");
      setPreferences({ ...preferences, enabled: true, volume: preferences.volume || 65 });
      setUnlocked(true); setAudioError("");
      if (!eligibleIds) playTone(context.current, preferences.sound, preferences.volume || 65);
    } catch (error) { setUnlocked(false); setAudioError(error instanceof Error ? error.message : "Sound is unavailable."); }
  }, [preferences, setPreferences, eligibleIds]);
  useEffect(() => {
    stopCurrent.current?.(); stopCurrent.current = null;
    if (!unlocked || !preferences.enabled || preferences.volume === 0 || !eligibleIds || !connected) return;
    const play = () => {
      if (context.current?.state !== "running") { setUnlocked(false); setAudioError("Audio has been suspended. Enable sound again."); return; }
      stopCurrent.current?.(); stopCurrent.current = playTone(context.current, preferences.sound, preferences.volume);
    };
    play(); const interval = setInterval(play, preferences.repeat * 1000);
    return () => { clearInterval(interval); stopCurrent.current?.(); stopCurrent.current = null; };
  }, [eligibleIds, unlocked, preferences.enabled, preferences.sound, preferences.volume, preferences.repeat, connected]);
  return { preferences, setPreferences, resetPreferences, unlocked, audioError, enable, timedOut, active: unlocked && preferences.enabled && preferences.volume > 0, hasLocal: local !== null };
}
