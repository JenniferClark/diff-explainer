import { API_BASE } from "./config";

export type Usage = {
    input_tokens: number;
    output_tokens: number;
}

// The caller passes these in. streamExplain calls them; it knows nothing about React.
export type StreamHandlers = {
    onDelta: (text: string) => void;
    onDone: (usage: Usage, costUsd: number) => void;
    onError: (message: string) => void;
}

// The 3 message types the backend sends
type ServerMessage =
    | { type: "delta"; text: string }
    | { type: "done"; usage: Usage; cost_usd: number }
    | { type: "error"; message: string };


// Turn one raw SSE message into an object. Return null if there is no "data:" line.
function parseMessage(raw: string): ServerMessage | null {
    for (const line of raw.split("\n")) {
        if (line.startsWith("data: ")) {
            return JSON.parse(line.slice("data: ".length)) as ServerMessage;
        }
    }
    return null
}

export async function streamExplain(diff: string, handlers: StreamHandlers, signal?: AbortSignal): Promise<void> {
    try {
        const res = await fetch(`${API_BASE}/explain/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diff }),
            signal
        })

        if (!res.ok) {
            handlers.onError(res.status === 422
                ? "The diff is empty or longer than 8,000 characters."
                : `Server error (HTTP ${res.status}). Try again.`);
            return;
        }

        if (!res.body) {
            handlers.onError("The server sent an empty response.");
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ""
        let finished = false;

        while (true) {
            const {value, done} = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, {stream: true});
            let sep: number;

            while ((sep = buffer.indexOf("\n\n")) !== -1) {
                const raw = buffer.slice(0, sep);
                buffer = buffer.slice(sep + 2);

                const msg = parseMessage(raw);
                if (!msg) continue;

                // Changed from step 5: call the handlers instead of console.log
                if (msg.type === "delta") {
                    handlers.onDelta(msg.text)
                } else if (msg.type === "done") {
                    handlers.onDone(msg.usage, msg.cost_usd)
                    finished = true;
                } else {
                    handlers.onError(msg.message)
                    finished = true;
                }
            }
        }
        if (!finished) {
            handlers.onError("The explanation was cut off. Try again.")
        }
    } catch(e: unknown) {
        if(e instanceof DOMException && e.name === "AbortError") {
            return;
        }else if(e instanceof TypeError) {
            console.error(e)
            handlers.onError("Can't reach the server. Check that the backend is running.");
        } else {
            handlers.onError("Something went wrong while reading the explanation.");
        }

    }
}