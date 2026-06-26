import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { NodeCard } from "../components/NodeCard";
import { NodeFilters } from "../components/NodeFilters";
import { NodeTable } from "../components/NodeTable";
import { ResultViewer } from "../components/ResultViewer";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import type { Node } from "../types";
import { useC2 } from "../store";

export function Nodes() {
  const { results, tasks } = useC2();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  const loadNodes = useCallback(
    (filters?: {
      status: string;
      os: string;
      group: string;
      tag: string;
      minHealth: string;
    }) => {
      api
        .listNodes({
          status: filters?.status || undefined,
          os: filters?.os || undefined,
          group: filters?.group || undefined,
          tag: filters?.tag || undefined,
          min_health: filters?.minHealth ? Number(filters.minHealth) : undefined,
        })
        .then(setNodes)
        .catch(() => {});
    },
    []
  );

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Nodes</h1>
        <p className="text-sm text-soc-muted">
          Registry of laboratory nodes. Click a node for detail, metadata editing, and
          evidence. Online status reflects live WebSocket connections only.
        </p>
      </div>

      <NodeFilters nodes={nodes} onChange={loadNodes} />

      {nodes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nodes.map((n) => (
            <NodeCard key={n.id} node={n} />
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
