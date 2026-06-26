import { AgentCard } from "../components/AgentCard";
import { AgentTable } from "../components/AgentTable";
import { ResultViewer } from "../components/ResultViewer";
import { useC2 } from "../store";

export function Agents() {
  const { agents, results } = useC2();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Agents</h1>
        <p className="text-sm text-soc-muted">
          Connected laboratory agents, their health, and quick tasks.
        </p>
      </div>

      {agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}

      <AgentTable agents={agents} />

      <ResultViewer results={results.slice(0, 20)} />
    </div>
  );
}
