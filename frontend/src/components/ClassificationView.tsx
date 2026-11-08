// Presentational only: renders one ClassifyState. No state, no fetch.
import type { ClassifyState } from "../hooks/useClassify";
import type { Classification } from "../api/classify";

type Label = Classification["label"];

// Each label gets a diff-style color: red for fixes, green for additions
const LABEL_TEXT: Record<Label, string> = {
    bugfix: "text-remove",
    feature: "text-add",
    refactor: "text-warn",
    docs: "text-info",
};

const LABEL_BAR: Record<Label, string> = {
    bugfix: "bg-remove",
    feature: "bg-add",
    refactor: "bg-warn",
    docs: "bg-info",
};

function gutterClass(state: ClassifyState): string {
    switch (state.status) {
        case "idle":
            return "bg-rule";
        case "loading":
            return "bg-action motion-safe:animate-pulse";
        case "done":
            return LABEL_BAR[state.result.label];
        case "error":
            return "bg-remove";
        case "stopped":
            return "bg-ink-muted";
    }
}

export function ClassificationView({ state }: { state: ClassifyState }) {
    return (
        <section
            aria-labelledby="classification-title"
            aria-busy={state.status === "loading"}
            className="flex gap-4 rounded-md border border-rule bg-surface p-5"
        >
            <div aria-hidden="true" className={`w-1 shrink-0 rounded-full ${gutterClass(state)}`} />
            <div className="min-w-0 flex-1 space-y-3">
                <h2 id="classification-title" className="font-bold">Label</h2>

                {state.status === "idle" && (
                    <p className="text-ink-muted">The label and the reason will appear here.</p>
                )}

                {state.status === "loading" && (
                    <div className="space-y-2">
                        <span className="sr-only">Classifying…</span>
                        <div aria-hidden="true" className="h-7 w-28 rounded bg-paper motion-safe:animate-pulse" />
                        <div aria-hidden="true" className="h-4 w-full rounded bg-paper motion-safe:animate-pulse" />
                        <div aria-hidden="true" className="h-4 w-2/3 rounded bg-paper motion-safe:animate-pulse" />
                    </div>
                )}

                {state.status === "done" && (
                    <>
                        <p className={`font-mono text-2xl font-medium ${LABEL_TEXT[state.result.label]}`}>
                            {state.result.label}
                        </p>
                        <p className="text-sm font-bold">
                            {state.result.needs_ticket ? "Needs a ticket" : "No ticket needed"}
                        </p>
                        <p className="leading-7">{state.result.reason}</p>
                    </>
                )}

                {state.status === "error" && <p className="text-sm text-remove">{state.message}</p>}

                {state.status === "stopped" && (
                    <p className="text-sm text-ink-muted">Stopped before a label was ready.</p>
                )}
            </div>
        </section>
    );
}