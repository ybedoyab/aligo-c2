import { useState } from "react";
import { NodeCard } from "../components/NodeCard";
import { NodeTable } from "../components/NodeTable";
import { ResultViewer } from "../components/ResultViewer";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import { useC2 } from "../store";

export function Nodes() {
  const { nodes, results, tasks } = useC2();
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Nodes</h1>
        <p className="text-sm text-soc-muted">
          Click an node for full detail, task history, and evidence. Quick tasks use
          allowlisted plugins only.
        </p>
      </div>

      {nodes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nodes.map((a) => (
            <NodeCard key={a.id} node={a} />
          ))}
        </div>
      )}

      <NodeTable nodes={nodes} />

      <ResultViewer
        results={results.slice(0, 20)}
        tasks={tasks}
        onOpenEvidence={setEvidenceTaskId}
      />

      <TaskEvidenceModal
        taskId={evidenceTaskId}
        onClose={() => setEvidenceTaskId(null)}
      />
    </div>
  );
}
