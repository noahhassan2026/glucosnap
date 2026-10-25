// Meal-time reminders. Browsers can only show a notification while the app (or its
// service worker) is running, so reminders fire from an in-app clock and the calendar
// export covers the times the app is closed.

export type ReminderKind = "eat" | "log";

export interface Reminder {
  id: string;
  label: string;
  time: string; // "HH:MM", local time
  days: number[]; // 0 = Sunday
  kind: ReminderKind;
  on: boolean;
}

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
// A reminder still fires if the app opens up to this many minutes late.
export const GRACE_MIN = 45;
// A log reminder is skipped when a meal was logged this close before it.
const LOGGED_WINDOW_MIN = 120;

export function defaultReminders(): Reminder[] {
  return [
    { id: "breakfast", label: "Breakfast", time: "08:00", days: EVERY_DAY, kind: "eat", on: false },
    { id: "lunch", label: "Lunch", time: "12:30", days: EVERY_DAY, kind: "eat", on: false },
    { id: "dinner", label: "Dinner", time: "18:30", days: EVERY_DAY, kind: "eat", on: false },
  ];
}

export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minutesOfDay(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function message(r: Reminder) {
  const meal = r.label.toLowerCase();
  return r.kind === "eat"
    ? { title: `Time for ${meal}`, body: "Snap your plate before you eat to see your glucose curve." }
    : { title: `Did you have ${meal}?`, body: "Log it in GlucoSnap to keep your streak going." };
}

// Reminders to fire now. fired maps reminder id to the local date it last fired.
export function dueReminders(list: Reminder[], now: Date, fired: Record<string, string>, lastMealAt?: string): Reminder[] {
  const today = localDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return list.filter((r) => {
    if (!r.on || fired[r.id] === today || !r.days.includes(now.getDay())) return false;
    const late = nowMin - minutesOfDay(r.time);
    if (late < 0 || late > GRACE_MIN) return false;
    if (r.kind === "log" && lastMealAt) {
      const since = (now.getTime() - Date.parse(lastMealAt)) / 6e4;
      if (since >= 0 && since < LOGGED_WINDOW_MIN) return false;
    }
    return true;
  });
}

// The next time any reminder will fire, for the "next reminder" line.
export function nextReminder(list: Reminder[], now: Date): { r: Reminder; at: Date } | null {
  let best: { r: Reminder; at: Date } | null = null;
  for (const r of list) {
    if (!r.on || !r.days.length) continue;
    const [h, m] = r.time.split(":").map(Number);
    for (let d = 0; d < 8; d++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m);
      if (at <= now || !r.days.includes(at.getDay())) continue;
      if (!best || at < best.at) best = { r, at };
      break;
    }
  }
  return best;
}

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// A calendar file with one repeating event per reminder, so phones remind even when
// the app is closed.
export function toIcs(list: Reminder[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const date = localDate(now).replace(/-/g, "");
  const events = list.filter((r) => r.on && r.days.length).map((r) => {
    const msg = message(r);
    return [
      "BEGIN:VEVENT",
      `UID:glucosnap-${r.id}@glucosnap`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${r.time.replace(":", "")}00`,
      "DURATION:PT15M",
      `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((d) => ICS_DAYS[d]).join(",")}`,
      `SUMMARY:${msg.title}`,
      `DESCRIPTION:${msg.body}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${msg.title}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GlucoSnap//Meal reminders//EN", ...events, "END:VCALENDAR", ""].join("\r\n");
}
