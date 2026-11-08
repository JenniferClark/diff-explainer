import { API_BASE } from "./config";
import type {Usage} from "./streamExplain.ts";

export type Classification = {
    label: "feature" | "bugfix" | "docs" | "refactor";
    reason: string;
    needs_ticket: boolean;
    usage: Usage;
    cost_usd: number;
}

// One result → a Promise: resolve with the result, or throw an Error
// whose message is ready to show to the user.
export async function classify(diff: string, signal?: AbortSignal): Promise<Classification> {
    let res: Response;

    try {
        res = await fetch(`${API_BASE}/classify`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ diff }),
            signal
        })

    } catch(e) {
        if(e instanceof DOMException && e.name === "AbortError") {
            throw e;
        }
        throw new Error("Can't reach the server. Check that the backend is running.")
    }

    if(res.status === 422) {
        throw new Error("The diff is empty or longer than 8,000 characters.")
    }

    if(res.status === 502) {
        throw new Error("The model could not classify this diff. Try again.")
    }

    if(!res.ok) {
        throw new Error(`Server error (HTTP ${res.status}). Try again.`)
    }

    return (await res.json()) as Classification;
}