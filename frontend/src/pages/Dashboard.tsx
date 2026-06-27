import { FleetTopologySummary } from "../components/FleetTopologySummary";
import {
  CompletedTasksIcon,
  FailedTasksIcon,
  LedgerIcon,
  MissionsIcon,
  NodesIcon,
  type NavIcon,
} from "../components/icons";
import { TimelineReplay } from "../components/TimelineReplay";
import { useI18n } from "../i18n";
import { useC2 } from "../store";

const DASHBOARD_STATUS = {
  ONLINE: "online",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  TIMEOUT: "timeout",
} as const;

interface MetricProps {
  label: string;
  value: number | string;
  accent: string;
  iconAccent: string;
  Icon: NavIcon;
}

function Metric({ label, value, accent, iconAccent, Icon }: MetricProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-soc-muted">{label}</div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-soc-bg/60 ${iconAccent}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

export function Dashboard() {
  const { t } = useI18n();
  const { nodes, missions, tasks, ledger } = useC2();

  const onlineNodes = nodes.filter((node) => node.status === DASHBOARD_STATUS.ONLINE);
  const activeMissions = missions.filter(
    (mission) => mission.status === DASHBOARD_STATUS.RUNNING
  ).length;
  const completedTasks = tasks.filter(
    (task) => task.status === DASHBOARD_STATUS.SUCCESS
  ).length;
  const failedTasks = tasks.filter(
    (task) =>
      task.status === DASHBOARD_STATUS.FAILED || task.status === DASHBOARD_STATUS.TIMEOUT
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("dashboard.title")}</h1>
        <p className="text-sm text-soc-muted">{t("dashboard.description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label={t("dashboard.nodesOnline")}
          value={onlineNodes.length}
          accent="text-soc-ok"
          iconAccent="border-soc-ok/30 text-soc-ok"
          Icon={NodesIcon}
        />
        <Metric
          label={t("dashboard.activeMissions")}
          value={activeMissions}
          accent="text-soc-accent"
          iconAccent="border-soc-accent/30 text-soc-accent"
          Icon={MissionsIcon}
        />
        <Metric
          label={t("dashboard.tasksCompleted")}
          value={completedTasks}
          accent="text-soc-ok"
          iconAccent="border-soc-ok/30 text-soc-ok"
          Icon={CompletedTasksIcon}
        />
        <Metric
          label={t("dashboard.tasksFailed")}
          value={failedTasks}
          accent="text-soc-err"
          iconAccent="border-soc-err/30 text-soc-err"
          Icon={FailedTasksIcon}
        />
        <Metric
          label={t("dashboard.ledgerEvents")}
          value={ledger.length}
          accent="text-soc-accent2"
          iconAccent="border-soc-accent2/30 text-soc-accent2"
          Icon={LedgerIcon}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <FleetTopologySummary onlineNodes={onlineNodes} />
        <TimelineReplay events={ledger} missions={missions} tasks={tasks} />
      </div>
    </div>
  );
}
