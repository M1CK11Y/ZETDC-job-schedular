import {
  JOBS,
  PRESETS,
  criticalCount,
  fcfsScheduler,
  isClock,
  pad,
  priorityScheduler,
  type Outage,
  type ScheduleRow,
  type Stats,
} from "./scheduler";

export type Line = { text: string; tone?: "fg" | "muted" | "primary" | "danger" };

const HELP = [
  "Commands",
  "  help                     this list",
  "  jobs                     household jobs and priorities",
  "  outages                  power-off windows",
  "  preset <light|typical|heavy>",
  "  outage add HH:MM HH:MM   add a cut (start must be before end)",
  "  outage clear             remove every window",
  "  run priority             priority-aware schedule",
  "  run fcfs                 first-come-first-served",
  "  compare                  both schedulers",
  "  clear                    wipe the screen",
  "  about                    what this program is",
];

export const COMMANDS = [
  "help",
  "jobs",
  "outages",
  "preset light",
  "preset typical",
  "preset heavy",
  "outage add ",
  "outage clear",
  "run priority",
  "run fcfs",
  "compare",
  "clear",
  "about",
];

function banner(): Line[] {
  return [
    { text: "CRITICAL JOBS  v1.0", tone: "primary" },
    { text: "SCS 1103 · Group 1 · CPU Tech Innovators", tone: "muted" },
    { text: "Keeping critical jobs alive under ZETDC load-shedding.", tone: "fg" },
    { text: "A simulation. Jobs do not share one socket — each finds the next open window.", tone: "muted" },
    { text: "Type help, or tap a command below.", tone: "muted" },
    { text: "" },
  ];
}

function table(rows: ScheduleRow[]): Line[] {
  const header = `${pad("ID", 5)} ${pad("JOB", 25)} ${pad("PRI", 4)} ${pad("ARR", 6)} ${pad("START", 6)} ${pad("END", 6)} ${pad("WAIT", 5)} STATUS`;
  const lines: Line[] = [
    { text: header, tone: "muted" },
    { text: "-".repeat(header.length), tone: "muted" },
  ];
  for (const row of rows) {
    const wait = String(row.wait);
    const line = `${pad(row.id, 5)} ${pad(row.name, 25)} ${pad(String(row.priority), 4)} ${pad(row.arrival, 6)} ${pad(row.start, 6)} ${pad(row.end, 6)} ${pad(wait, 5)} ${row.status}`;
    lines.push({ text: line, tone: row.status === "Completed" ? "fg" : "danger" });
  }
  return lines;
}

function statsLines(label: string, stats: Stats, total: number, critical: number): Line[] {
  const avg = stats.completed > 0 ? (stats.totalWait / stats.completed).toFixed(1) : "—";
  return [
    { text: label, tone: "primary" },
    { text: `  Critical completed   ${stats.criticalCompleted} / ${critical}` },
    { text: `  Jobs completed       ${stats.completed} / ${total}` },
    { text: `  Average wait         ${avg} min` },
  ];
}

export function boot(): Line[] {
  return banner();
}

export function exec(raw: string, outages: Outage[]): { lines: Line[]; outages: Outage[]; clear?: boolean } {
  const input = raw.trim().replace(/\s+/g, " ");
  if (!input) return { lines: [], outages };

  const [cmd, ...rest] = input.split(" ");
  const arg = rest.join(" ");

  if (cmd === "help") {
    return { lines: HELP.map((text, i) => ({ text, tone: i === 0 ? "primary" : "fg" }) as Line), outages };
  }

  if (cmd === "about") {
    return {
      lines: [
        { text: "Keeping Critical Jobs Alive", tone: "primary" },
        { text: "Priority 1 runs first, then earlier arrivals." },
        { text: "FCFS ignores priority and only uses arrival time." },
        { text: "A job finishes only if it can sit entirely outside a cut." },
        { text: "Sample day: neighbourhood appliances, 2021-style ZETDC windows." },
      ],
      outages,
    };
  }

  if (cmd === "clear") return { lines: [], outages, clear: true };

  if (cmd === "jobs") {
    const lines: Line[] = [
      { text: "HOUSEHOLD JOBS", tone: "primary" },
      { text: `${pad("ID", 5)} ${pad("NAME", 25)} ${pad("ARR", 6)} ${pad("MIN", 5)} PRI`, tone: "muted" },
    ];
    for (const job of JOBS) {
      const label = job.priority === 1 ? "critical" : job.priority === 2 ? "medium" : "low";
      lines.push({
        text: `${pad(job.id, 5)} ${pad(job.name, 25)} ${pad(job.arrival, 6)} ${pad(String(job.duration), 5)} ${job.priority} ${label}`,
        tone: job.priority === 1 ? "primary" : "fg",
      });
    }
    return { lines, outages };
  }

  if (cmd === "outages") {
    if (outages.length === 0) return { lines: [{ text: "No outages. Power is on all day.", tone: "muted" }], outages };
    return {
      lines: [
        { text: "POWER OFF", tone: "danger" },
        ...outages.map((o) => ({ text: `  ${o.start} – ${o.end}`, tone: "danger" as const })),
      ],
      outages,
    };
  }

  if (cmd === "preset") {
    const name = arg.toLowerCase();
    const next = PRESETS[name];
    if (!next) {
      return { lines: [{ text: "Use: preset light | typical | heavy", tone: "danger" }], outages };
    }
    return {
      lines: [
        { text: `Loaded ${name} day.`, tone: "primary" },
        ...next.map((o) => ({ text: `  off ${o.start}–${o.end}`, tone: "danger" as const })),
      ],
      outages: next.map((o) => ({ ...o })),
    };
  }

  if (cmd === "outage" && rest[0] === "clear") {
    return { lines: [{ text: "Outages cleared.", tone: "primary" }], outages: [] };
  }

  if (cmd === "outage" && rest[0] === "add") {
    const start = rest[1];
    const end = rest[2];
    if (!start || !end || !isClock(start) || !isClock(end)) {
      return { lines: [{ text: "Use: outage add HH:MM HH:MM", tone: "danger" }], outages };
    }
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const a = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
    const b = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    if (a >= b) return { lines: [{ text: "Start must be before end, same day.", tone: "danger" }], outages };
    const next = [...outages, { start: a, end: b }].sort((x, y) => x.start.localeCompare(y.start));
    return { lines: [{ text: `Added cut ${a}–${b}.`, tone: "primary" }], outages: next };
  }

  if (cmd === "run" && (arg === "priority" || arg === "fcfs")) {
    const critical = criticalCount(JOBS);
    const result = arg === "priority" ? priorityScheduler(JOBS, outages) : fcfsScheduler(JOBS, outages);
    const title = arg === "priority" ? "PRIORITY SCHEDULER" : "FCFS SCHEDULER";
    return {
      lines: [...table(result.schedule), { text: "" }, ...statsLines(title, result.stats, JOBS.length, critical)],
      outages,
    };
  }

  if (cmd === "compare") {
    const critical = criticalCount(JOBS);
    const p = priorityScheduler(JOBS, outages);
    const f = fcfsScheduler(JOBS, outages);
    return {
      lines: [
        ...statsLines("PRIORITY", p.stats, JOBS.length, critical),
        { text: "" },
        ...statsLines("FCFS", f.stats, JOBS.length, critical),
        { text: "" },
        {
          text:
            p.stats.criticalCompleted === f.stats.criticalCompleted
              ? "Critical completion matches on this day. Try preset heavy."
              : `Priority saves ${p.stats.criticalCompleted - f.stats.criticalCompleted} more critical job(s).`,
          tone: "primary",
        },
      ],
      outages,
    };
  }

  return { lines: [{ text: `Unknown command: ${input}. Type help.`, tone: "danger" }], outages };
}
