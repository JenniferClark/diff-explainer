import {useState} from "react";
import { DiffInput } from "./DiffInput";
import { useExplainStream } from "../hooks/useExplainStream";
import { ExplanationView } from "./ExplanationView";
import { useClassify } from "../hooks/useClassify.ts";
import {ClassificationView} from "./ClassificationView.tsx";
import {UsageBar} from "./UsageBar.tsx";

const MAX_CHARS = 8000;
const EXAMPLE_DIFF = `--- a/sync.py
+++ b/sync.py
@@ def sync_ticket(user):
-    if user.assignee:
+    if user.assignee is not None:
         sync(user.assignee)`;

function App() {
  const [diff, setDiff] = useState("");

  const explain = useExplainStream();

  const classifier = useClassify();

  const handleExplain = () => {
      explain.start(diff);
      classifier.start(diff);
  }

  const handleStop = () => {
      explain.stop();
      classifier.stop();
  }

  const isRunning = explain.status === "streaming" || classifier.state.status === "loading";

  const canExplain = diff.trim() !== "" && diff.length <= MAX_CHARS && !isRunning;

  const classifyCost = classifier.state.status === "done" ? classifier.state.result.cost_usd : null;
  const classifyUsage = classifier.state.status === "done" ? classifier.state.result.usage : null;
  const explainCost = explain.status === "done" ? explain.costUsd : null;

  const totalCost = explainCost === null && classifyCost === null ? null : (explainCost ?? 0) + (classifyCost ?? 0)


  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Diff Explainer</h1>
        <p className="text-ink-muted">
          Paste a git diff. Get a plain-English explanation and a label.
        </p>
      </header>

      <DiffInput
        value={diff}
        onChange={setDiff}
        onLoadExample={() => {
          setDiff(EXAMPLE_DIFF);
        }}
        onExplain={handleExplain}
        onStop={handleStop}
        showStop={isRunning}
        canExplain={canExplain}
        maxChars={MAX_CHARS}
        readOnly={isRunning}
      />

      <div className="grid gap-6 md:grid-cols-2">
          <ExplanationView
              status={explain.status}
              text={explain.text}
              errorMessage={explain.error}
          />

          <ClassificationView
              state={classifier.state}
          />
      </div>

      <UsageBar explainUsage={explain.usage} classifyUsage={classifyUsage} totalCostUsd={totalCost}  />
    </main>
  );
}

export default App;