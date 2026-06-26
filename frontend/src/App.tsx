import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NodeDetailPage } from "./pages/NodeDetail";
import { Nodes } from "./pages/Nodes";
import { Console } from "./pages/Console";
import { Dashboard } from "./pages/Dashboard";
import { Demo } from "./pages/Demo";
import { Ledger } from "./pages/Ledger";
import { Missions } from "./pages/Missions";
import { EvidenceVerifier } from "./pages/EvidenceVerifier";
import { IoTLab } from "./pages/IoTLab";
import { Topology } from "./pages/Topology";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="nodes" element={<Nodes />} />
        <Route path="nodes/:nodeId" element={<NodeDetailPage />} />
        <Route path="topology" element={<Topology />} />
        <Route path="iot-lab" element={<IoTLab />} />
        <Route path="missions" element={<Missions />} />
        <Route path="console" element={<Console />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="evidence-verifier" element={<EvidenceVerifier />} />
        <Route path="demo" element={<Demo />} />
      </Route>
    </Routes>
  );
}
