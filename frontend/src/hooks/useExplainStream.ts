import {useState, useRef, useEffect} from "react";
import {streamExplain, type Usage} from "../api/streamExplain";

export type ExplainStatus = "idle" | "streaming" | "done" | "error" | "stopped";

export function useExplainStream() {
    const [status, setStatus] = useState<ExplainStatus>("idle");
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null)
    const [costUsd, setCostUse] = useState<number | null>(null);

    const controllerRef = useRef<AbortController | null>(null);

    function start(diff: string) {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setText("");
        setError(null);
        setStatus("streaming");
        setUsage(null);
        setCostUse(null);
        streamExplain(diff, {
            onDelta: (newText) => {
                setText(pre => pre + newText);
            },
            onDone: (usage, costUsd) => {
                setStatus("done");
                setUsage(usage);
                setCostUse(costUsd);
            },
            onError: (message) => {
                setStatus("error");
                setError(message);
            }
        }, controller.signal)
    }

    function stop() {
        controllerRef.current?.abort();
        setStatus(prev => (prev === "streaming" ? "stopped" : prev));
    }

    useEffect(() => {
        // Cleanup runs when the component unmounts
        return () => controllerRef.current?.abort();
    }, []);

    return { status, text, start, stop, error, usage, costUsd }
}