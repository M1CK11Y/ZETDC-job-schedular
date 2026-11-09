# ZETDC job schedular

SCS 1103 · Group 1 · CPU Tech Innovators

Terminal application that schedules household jobs around ZETDC load-shedding.

Priority scheduling runs critical jobs first. FCFS is the baseline. Each job must finish entirely outside a power cut.

## Commands

- `help`
- `jobs`
- `outages`
- `preset light | typical | heavy`
- `outage add HH:MM HH:MM`
- `outage clear`
- `run priority`
- `run fcfs`
- `compare`
- `clear`

## Source

- `src/lib/scheduler.ts` — jobs, outages, priority and FCFS
- `src/lib/shell.ts` — terminal commands
- `src/components/TerminalApp.tsx` — terminal UI
