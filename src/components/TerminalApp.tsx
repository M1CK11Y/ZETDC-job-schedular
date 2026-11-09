import { useEffect, useRef, useState } from "react";
import { COMMANDS, boot, exec, type Line } from "../lib/shell";
import type { Outage } from "../lib/scheduler";
import { PRESETS } from "../lib/scheduler";

const QUICK = ["help", "jobs", "outages", "run priority", "run fcfs", "compare", "preset heavy"];

type Entry = { kind: "in"; text: string } | { kind: "out"; lines: Line[] };

export function TerminalApp() {
  const [outages, setOutages] = useState<Outage[]>(PRESETS.typical.map((o) => ({ ...o })));
  const [entries, setEntries] = useState<Entry[]>([{ kind: "out", lines: boot() }]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState(-1);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [entries, value]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const result = exec(text, outages);
    setOutages(result.outages);
    setHistory((h) => [...h, text]);
    setHistIndex(-1);
    setDraft("");
    setValue("");
    setEntries((prev) => {
      const base = result.clear ? [] : prev;
      return [...base, { kind: "in", text }, { kind: "out", lines: result.lines }];
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(value);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next = histIndex === -1 ? history.length - 1 : Math.max(0, histIndex - 1);
      if (histIndex === -1) setDraft(value);
      setHistIndex(next);
      setValue(history[next] ?? "");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (histIndex === -1) return;
      const next = histIndex + 1;
      if (next >= history.length) {
        setHistIndex(-1);
        setValue(draft);
      } else {
        setHistIndex(next);
        setValue(history[next] ?? "");
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const match = COMMANDS.filter((c) => c.startsWith(value));
      if (match.length === 1) setValue(match[0]);
    }
  }

  return (
    <main className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs tracking-widest text-primary uppercase">jobs@zetdc</p>
          <h1 className="text-sm font-medium text-fg">ZETDC job schedular</h1>
        </div>
        <p className="max-w-[45%] text-right text-xs text-muted">
          {outages.length === 0 ? "power on all day" : outages.map((o) => `${o.start}–${o.end}`).join(" · ")}
        </p>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto px-4 py-4" onClick={() => inputRef.current?.focus()}>
        <div className="mx-auto max-w-4xl space-y-3">
          {entries.map((entry, index) =>
            entry.kind === "in" ? (
              <p key={index} className="whitespace-pre-wrap break-all">
                <span className="text-primary">jobs@zetdc:~$ </span>
                <span>{entry.text}</span>
              </p>
            ) : (
              <div key={index}>
                {entry.lines.map((line, i) => (
                  <p
                    key={i}
                    className={`whitespace-pre-wrap break-all leading-relaxed ${
                      line.tone === "primary"
                        ? "text-primary"
                        : line.tone === "danger"
                          ? "text-danger"
                          : line.tone === "muted"
                            ? "text-muted"
                            : "text-fg"
                    }`}
                  >
                    {line.text || " "}
                  </p>
                ))}
              </div>
            ),
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit(value);
            }}
          >
            <label htmlFor="cmd" className="shrink-0 text-primary">
              jobs@zetdc:~$
            </label>
            <input
              id="cmd"
              ref={inputRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setHistIndex(-1);
              }}
              onKeyDown={onKeyDown}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Command"
              className="min-w-0 flex-1 bg-transparent text-fg outline-none"
            />
          </form>
        </div>
      </div>
    </main>
  );
}
