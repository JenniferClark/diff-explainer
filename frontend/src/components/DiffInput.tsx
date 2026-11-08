// Presentational only: receives props and renders. No state, no fetch.

import {useId} from "react";

type DiffInputProps = {
  value: string;
  onChange: (value: string) => void;
  onLoadExample: () => void;
  onExplain: () => void;
  onStop: () => void;
  showStop: boolean;
  canExplain: boolean;
  maxChars: number;
  readOnly: boolean;
};

export function DiffInput(props: DiffInputProps) {
  const count = props.value.length;
  const overLimit = count > props.maxChars;
  const nearLimit = !overLimit && count > props.maxChars * 0.9;

  const inputId = useId();
  const countId = useId();

  const countColor = overLimit
    ? "text-remove"
    : nearLimit
      ? "text-warn"
      : "text-ink-muted";

  return (
    <section className="space-y-3">
      <label htmlFor={inputId} className="block font-bold">
        Your diff
      </label>

      <textarea
        id={countId}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        readOnly={props.readOnly}
        spellCheck={false}
        placeholder="Paste the output of git diff here"
        aria-describedby="diff-count"
        aria-invalid={overLimit}
        className="block h-56 w-full resize-y rounded-md border border-rule bg-surface p-4
                   font-mono text-sm leading-6 text-ink placeholder:text-ink-muted
                   focus:border-action focus:outline-none focus:ring-2 focus:ring-action/30
                   read-only:bg-paper read-only:text-ink-muted
                   aria-invalid:border-remove"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={props.onLoadExample}
            disabled={props.readOnly}
            className="rounded text-sm text-action underline-offset-4 hover:underline
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use example diff
          </button>

          <p id="diff-count" className={`text-sm tabular-nums ${countColor}`}>
            {count.toLocaleString()}/{props.maxChars.toLocaleString()}{" "}
            characters
            {overLimit && ". Remove some lines to continue."}
          </p>
        </div>

        <div className="flex gap-2">
            {
                props.showStop && (
                    <button
                        type="button"
                        onClick={props.onStop}
                        className="rounded-md border border-rule bg-surface px-5 py-2.5 font-bold text-ink
               hover:bg-paper
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                    >
                        Stop
                    </button>)
            }
            <button
                type="button"
                onClick={props.onExplain}
                disabled={!props.canExplain}
                className="rounded-md bg-action px-5 py-2.5 font-bold text-white
                     hover:bg-action-dark
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action
                     disabled:cursor-not-allowed disabled:opacity-40"
            >
                Explain diff
            </button>
        </div>

      </div>
    </section>
  );
}
