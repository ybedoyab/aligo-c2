import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { NodeCard } from "../components/NodeCard";
import { NodeFilters, type NodeFilterValues } from "../components/NodeFilters";
import { NodeTable } from "../components/NodeTable";
import { ResultViewer } from "../components/ResultViewer";
import { TaskEvidenceModal } from "../components/TaskEvidenceModal";
import { DeviceIcon, RefreshIcon } from "../components/icons";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import type { Node } from "../types";

const CARD_ANIMATION_DELAY_MS = 55;
const LOADING_PLACEHOLDERS = ["node-loading-1", "node-loading-2", "node-loading-3", "node-loading-4"];

export function Nodes() {
  const { t } = useI18n();
  const { results, tasks } = useC2();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

  const loadNodes = useCallback(async (filters?: NodeFilterValues) => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const loadedNodes = await api.listNodes({
        status: filters?.status || undefined,
        os: filters?.os || undefined,
        group: filters?.group || undefined,
        tag: filters?.tag || undefined,
        min_health: filters?.minHealth ? Number(filters.minHealth) : undefined,
      });
      setNodes(loadedNodes);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);


  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">{t("nodes.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-soc-muted">
          {t("nodes.description")}
        </p>
      </header>


      <NodeFilters nodes={nodes} onChange={loadNodes} />

      {loadFailed ? (
        <div className="card flex flex-col items-center gap-3 px-4 py-10 text-center">
          <RefreshIcon className="h-8 w-8 text-soc-err" />
          <p className="text-sm text-soc-muted">{t("nodes.loadError")}</p>
          <button type="button" className="btn-ghost text-xs" onClick={() => void loadNodes()}>
            <RefreshIcon className="h-4 w-4" />
            {t("nodes.retry")}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {LOADING_PLACEHOLDERS.map((placeholder) => (
            <div key={placeholder} className="card h-64 animate-pulse bg-soc-panel2/60" />
          ))}
        </div>
      ) : null}

      {!loading && !loadFailed ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">{t("nodes.cardsTitle")}</h2>
            <span className="text-xs text-soc-muted">
              {t("nodes.resultsCount", { count: nodes.length })}
            </span>
          </div>
          {nodes.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 px-4 py-10 text-center">
              <DeviceIcon className="h-9 w-9 text-soc-muted" />
              <p className="text-sm text-soc-muted">{t("nodes.empty")}</p>
              <code className="rounded-lg border border-soc-borderSubtle bg-soc-bg/60 px-3 py-2 text-xs text-soc-accent">
                {t("nodes.emptyCli")}
              </code>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {nodes.map((node, index) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  animationDelayMs={index * CARD_ANIMATION_DELAY_MS}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !loadFailed ? <NodeTable nodes={nodes} /> : null}

      <ResultViewer
        results={results.slice(0, 20)}
        tasks={tasks}
        onOpenEvidence={setEvidenceTaskId}
      />

      <TaskEvidenceModal taskId={evidenceTaskId} onClose={() => setEvidenceTaskId(null)} />
    </div>
  );
}
