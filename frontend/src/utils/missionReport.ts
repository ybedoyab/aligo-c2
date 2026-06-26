import { api } from "../api/client";

export async function downloadMissionReport(
  missionId: string,
  format: "json" | "markdown"
): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "");
  if (format === "markdown") {
    const { markdown } = (await api.exportMissionReport(missionId, "markdown")) as {
      markdown: string;
    };
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${missionId}-${stamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const data = await api.exportMissionReport(missionId, "json", true);
  if (!("report" in data)) return;
  const blob = new Blob([JSON.stringify(data.report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${missionId}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
