import { useEffect, useRef, useState } from "react";
import { classify, type Classification } from "../api/classify.ts";

export type ClassifyState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; result: Classification }
    | { status: "error"; message: string }
    | { status: "stopped"}

export function useClassify() {
    const [state, setState] = useState<ClassifyState>({ status: "idle" });
    const controllerRef = useRef<AbortController | null>(null);

    async function start(diff: string) {
        controllerRef.current?.abort();
        setState({ status: "loading" })
        const controller = new AbortController()
        controllerRef.current = controller;

        try {
            const result = await classify(diff, controller.signal);
            setState({ status: "done", result })
        } catch(e) {
            if(e instanceof DOMException && e.name === "AbortError") {
                return;
            }
            setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." })
        }
    }

    function stop() {
        setState(pre => {
            if(pre.status === "loading") {
                return { status: "stopped" }
            }
            return pre;
        });

        controllerRef.current?.abort()
    }

    useEffect(() => {
        return () => controllerRef.current?.abort()
    }, [])

    return { state, start, stop }
}