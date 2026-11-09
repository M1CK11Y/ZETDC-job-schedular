export type Job = {
  id: string;
  name: string;
  arrival: string;
  duration: number;
  priority: 1 | 2 | 3;
};

export type Outage = { start: string; end: string };

export type ScheduleRow = {
  id: string;
  name: string;
  priority: number;
  arrival: string;
  start: string;
  end: string;
  wait: number | "-";
  status: "Completed" | "Not Completed";
};

export type Stats = {
  completed: number;
  criticalCompleted: number;
  totalWait: number;
};

export const JOBS: Job[] = [
  { id: "J01", name: "Fridge / Freezer", arrival: "07:30", duration: 40, priority: 1 },
  { id: "J02", name: "Water Pump", arrival: "07:45", duration: 35, priority: 1 },
  { id: "J03", name: "Study / Exam Lighting", arrival: "08:00", duration: 90, priority: 1 },
  { id: "J04", name: "Security Lights + CCTV", arrival: "08:20", duration: 60, priority: 1 },
  { id: "J05", name: "Wi-Fi Router", arrival: "08:40", duration: 120, priority: 1 },
  { id: "J06", name: "Laptop / Phone Charging", arrival: "09:15", duration: 70, priority: 2 },
  { id: "J07", name: "Kitchen Kettle", arrival: "09:40", duration: 12, priority: 2 },
  { id: "J08", name: "Computer Lab PCs", arrival: "10:00", duration: 100, priority: 2 },
  { id: "J09", name: "Microwave", arrival: "11:00", duration: 15, priority: 2 },
  { id: "J10", name: "Television", arrival: "12:30", duration: 60, priority: 3 },
  { id: "J11", name: "Electric Geyser", arrival: "13:00", duration: 45, priority: 3 },
  { id: "J12", name: "Fans / Ventilation", arrival: "14:00", duration: 50, priority: 3 },
  { id: "J13", name: "Washing Machine", arrival: "15:30", duration: 75, priority: 3 },
  { id: "J14", name: "Ironing", arrival: "16:00", duration: 30, priority: 3 },
];

export const PRESETS: Record<string, Outage[]> = {
  light: [{ start: "12:00", end: "13:00" }],
  typical: [
    { start: "11:00", end: "14:00" },
    { start: "17:30", end: "21:00" },
  ],
  heavy: [
    { start: "08:00", end: "12:00" },
    { start: "16:00", end: "21:00" },
  ],
};

export function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isClock(value: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(value)) return false;
  const mins = toMinutes(value);
  return mins >= 0 && mins < 24 * 60 && Number(value.split(":")[1]) < 60;
}

function canRun(start: number, duration: number, outages: [number, number][]): boolean {
  const end = start + duration;
  return !outages.some(([oStart, oEnd]) => start < oEnd && end > oStart);
}

function findNextSlot(arrival: number, duration: number, outages: [number, number][]): number | null {
  let current = arrival;
  const dayEnd = 24 * 60;
  while (current + duration <= dayEnd) {
    if (canRun(current, duration, outages)) return current;
    let jumped = false;
    for (const [oStart, oEnd] of outages) {
      if (current < oEnd && current + duration > oStart) {
        current = oEnd;
        jumped = true;
        break;
      }
    }
    if (!jumped) current += 5;
  }
  return null;
}

function run(jobs: Job[], outages: Outage[], mode: "priority" | "fcfs"): { schedule: ScheduleRow[]; stats: Stats } {
  const windows: [number, number][] = outages.map((o) => [toMinutes(o.start), toMinutes(o.end)]);
  const sorted = [...jobs].sort((a, b) => {
    if (mode === "priority") {
      return a.priority - b.priority || toMinutes(a.arrival) - toMinutes(b.arrival);
    }
    return toMinutes(a.arrival) - toMinutes(b.arrival);
  });

  const schedule: ScheduleRow[] = [];
  const stats: Stats = { completed: 0, criticalCompleted: 0, totalWait: 0 };

  for (const job of sorted) {
    const arrival = toMinutes(job.arrival);
    const start = findNextSlot(arrival, job.duration, windows);
    if (start !== null) {
      const wait = start - arrival;
      schedule.push({
        id: job.id,
        name: job.name,
        priority: job.priority,
        arrival: job.arrival,
        start: toTime(start),
        end: toTime(start + job.duration),
        wait,
        status: "Completed",
      });
      stats.completed += 1;
      stats.totalWait += wait;
      if (job.priority === 1) stats.criticalCompleted += 1;
    } else {
      schedule.push({
        id: job.id,
        name: job.name,
        priority: job.priority,
        arrival: job.arrival,
        start: "-",
        end: "-",
        wait: "-",
        status: "Not Completed",
      });
    }
  }

  return { schedule, stats };
}

export function priorityScheduler(jobs: Job[], outages: Outage[]) {
  return run(jobs, outages, "priority");
}

export function fcfsScheduler(jobs: Job[], outages: Outage[]) {
  return run(jobs, outages, "fcfs");
}

export function criticalCount(jobs: Job[]): number {
  return jobs.filter((j) => j.priority === 1).length;
}

export function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + " ".repeat(width - value.length);
}
