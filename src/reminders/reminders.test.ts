import { describe, expect, it } from "vitest";
import { defaultReminders, dueReminders, nextReminder, toIcs, type Reminder } from "./reminders";

const lunch: Reminder = { id: "lunch", label: "Lunch", time: "12:30", days: [0, 1, 2, 3, 4, 5, 6], kind: "eat", on: true };
const at = (h: number, m: number, day = 24) => new Date(2026, 9, day, h, m); // Sat 24 Oct 2026

describe("due reminders", () => {
  it("fires at the set time and within the grace window", () => {
    expect(dueReminders([lunch], at(12, 29), {})).toEqual([]);
    expect(dueReminders([lunch], at(12, 30), {})).toEqual([lunch]);
    expect(dueReminders([lunch], at(13, 10), {})).toEqual([lunch]);
    expect(dueReminders([lunch], at(13, 30), {})).toEqual([]);
  });

  it("fires once a day", () => {
    expect(dueReminders([lunch], at(12, 31), { lunch: "2026-10-24" })).toEqual([]);
    expect(dueReminders([lunch], at(12, 31), { lunch: "2026-10-23" })).toEqual([lunch]);
  });

  it("respects off switches and chosen days", () => {
    expect(dueReminders([{ ...lunch, on: false }], at(12, 30), {})).toEqual([]);
    expect(dueReminders([{ ...lunch, days: [1, 2, 3, 4, 5] }], at(12, 30), {})).toEqual([]); // Saturday
  });

  it("skips a log reminder when the meal is already logged", () => {
    const log = { ...lunch, kind: "log" as const };
    expect(dueReminders([log], at(12, 30), {}, at(12, 5).toISOString())).toEqual([]);
    expect(dueReminders([log], at(12, 30), {}, at(8, 0).toISOString())).toEqual([log]);
    expect(dueReminders([lunch], at(12, 30), {}, at(12, 5).toISOString())).toEqual([lunch]);
  });
});

describe("next reminder and calendar", () => {
  it("finds the next time, rolling to tomorrow", () => {
    expect(nextReminder([lunch], at(9, 0))?.at).toEqual(at(12, 30));
    expect(nextReminder([lunch], at(13, 0))?.at).toEqual(at(12, 30, 25));
    expect(nextReminder(defaultReminders(), at(9, 0))).toBeNull();
  });

  it("writes a weekly repeating event per reminder", () => {
    const ics = toIcs([{ ...lunch, days: [1, 3, 5] }], at(9, 0));
    expect(ics).toContain("DTSTART:20261024T123000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(ics).toContain("SUMMARY:Time for lunch");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
