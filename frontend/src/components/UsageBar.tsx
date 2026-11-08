import type { Usage } from "../api/streamExplain";

type Props = {
    explainUsage: Usage | null;
    classifyUsage: Usage | null;
    totalCostUsd: number | null;
}

function formatUsage(usage: Usage | null): string {
    return usage ? `${usage.input_tokens} in, ${usage.output_tokens} out` : "Not run yet";
}

export function UsageBar({
                             explainUsage,
                             classifyUsage,
                             totalCostUsd
                         }: Props) {
    return (
        <footer aria-label="Token usage and cost" className="border-t border-rule pt-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                    <dt className="text-ink-muted">Explanation tokens</dt>
                    <dd className="font-mono tabular-nums">{formatUsage(explainUsage)}</dd>
                </div>
                <div>
                    <dt className="text-ink-muted">Label tokens</dt>
                    <dd className="font-mono tabular-nums">{formatUsage(classifyUsage)}</dd>
                </div>
                <div>
                    <dt className="text-ink-muted">Estimated cost</dt>
                    <dd className="font-mono tabular-nums">
                        {totalCostUsd === null ? "Not run yet" : `$${totalCostUsd.toFixed(6)}`}
                    </dd>
                </div>
            </dl>
        </footer>
    );
}