import { useCallback, useEffect, useRef, useState } from "react";
import { load, loadArray, save } from "../storage";
import { defaultReminders, dueReminders, localDate, message, type Reminder } from "./reminders";

const KEY = "glucosnap-reminders";
const FIRED_KEY = "glucosnap-reminders-fired";

export type Permission = NotificationPermission | "unsupported";

export interface Alert {
  id: string;
  title: string;
  body: string;
}

function permission(): Permission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

// Android Chrome only shows notifications through a service worker, so prefer it.
async function showSystem(title: string, body: string, tag: string) {
  const opts: NotificationOptions = { body, tag, icon: "/favicon.svg", badge: "/favicon.svg" };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return void (await reg.showNotification(title, opts));
    new Notification(title, opts);
  } catch {
    /* the in-app banner still shows */
  }
}

export function useReminders(lastMealAt?: string) {
  const [list, setList] = useState<Reminder[]>(() => {
    const saved = loadArray<Reminder>(KEY);
    return saved.length ? saved : defaultReminders();
  });
  const [perm, setPerm] = useState<Permission>(permission);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const fired = useRef<Record<string, string>>(load(FIRED_KEY, {}));
  const lastMeal = useRef(lastMealAt);
  lastMeal.current = lastMealAt;

  useEffect(() => save(KEY, list), [list]);

  const check = useCallback(() => {
    const now = new Date();
    const due = dueReminders(list, now, fired.current, lastMeal.current);
    if (!due.length) return;
    for (const r of due) {
      fired.current[r.id] = localDate(now);
      const m = message(r);
      if (permission() === "granted") showSystem(m.title, m.body, "glucosnap-" + r.id);
      setAlerts((a) => [...a.filter((x) => x.id !== r.id), { id: r.id, ...m }]);
    }
    save(FIRED_KEY, fired.current);
  }, [list]);

  // Background tabs throttle timers to about once a minute, which is close enough.
  useEffect(() => {
    check();
    const id = setInterval(check, 20_000);
    const onVis = () => { if (document.visibilityState === "visible") { setPerm(permission()); check(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [check]);

  const enableNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported" as const;
    try {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.register("/sw.js");
    } catch {
      /* plain notifications still work on desktop */
    }
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPerm(p);
    return p;
  }, []);

  return {
    list,
    setList,
    perm,
    alerts,
    dismiss: (id: string) => setAlerts((a) => a.filter((x) => x.id !== id)),
    enableNotifications,
    test: async () => {
      const m = { title: "GlucoSnap reminders are on", body: "This is how a meal reminder will look." };
      if (permission() === "granted") await showSystem(m.title, m.body, "glucosnap-test");
      setAlerts((a) => [...a.filter((x) => x.id !== "test"), { id: "test", ...m }]);
    },
  };
}
