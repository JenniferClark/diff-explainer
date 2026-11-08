import type { ExplainStatus } from "../hooks/useExplainStream";

type Props = {
    status: ExplainStatus;
    text: string;
    errorMessage: string | null;
}

// Gutter color follows the status, like the +/- bar in a diff view
const GUTTER: Record<ExplainStatus, string> = {
    idle: "bg-rule",
    streaming: "bg-action motion-safe:animate-pulse", // no animation if the user prefers reduced motion
    done: "bg-add",
    error: "bg-remove",
    stopped: "bg-ink-muted",
}

const STATUS_LINE: Record<Exclude<ExplainStatus, "idle">, { className: string; label: string}> = {
    streaming: { className: "text-ink-muted", label: "Writing…" },
    done: { className: "text-add", label: "Done" },
    error: { className: "text-remove", label: "The explanation stopped because of an error." },
    stopped: { className: "text-ink-muted", label: "Stopped. The text above is incomplete." },
}

// One short sentence per status. Screen readers read it when it changes.
function statusMessage(status: ExplainStatus, errorMessage: string | null): string {
    switch (status) {
        case "idle":      return "";
        case "streaming": return "Explaining the diff…";
        case "done":      return "Explanation ready.";
        case "stopped":   return "Explanation stopped. Partial text kept.";
        case "error":     return `Explanation failed: ${errorMessage ?? "unknown error"}`;
    }
}

export function ExplanationView({ status, text, errorMessage }: Props) {
    // One short sentence per status. Screen readers read it when it changes.

    return (
        <section aria-labelledby="explanation-title" className="flex gap-4 rounded-md border border-rule bg-surface p-5">
            <div aria-hidden="true" className={`w-1 shrink-0 rounded-full ${GUTTER[status]}`} />
            <div className="min-w-0 flex-1 space-y-3">
                <h2 id="explanation-title" className="font-bold">Explanation</h2>

                {/* Always rendered (also when idle), so screen readers notice when the text changes */}
                <p aria-live="polite" className="sr-only">{statusMessage(status, errorMessage)}</p>

                {
                   status === "idle" ? (
                     <p className="text-ink-muted">Paste a diff and select Explain diff to see what it changes.</p>
                   ) : (
                        <>
                            <p className="whitespace-pre-wrap leading-7">{text}</p>
                            <p className={`text-sm ${STATUS_LINE[status].className}`}>{ STATUS_LINE[status].label}</p>
                            {
                                status === "error" && errorMessage && <p className={`text-sm ${STATUS_LINE["error"].className}`}>{ errorMessage}</p>
                            }
                        </>
                       )
                }
            </div>
        </section>
    );
}