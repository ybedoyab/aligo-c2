import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Agents } from "./pages/Agents";
import { Dashboard } from "./pages/Dashboard";
import { Demo } from "./pages/Demo";
import { Ledger } from "./pages/Ledger";
import { Missions } from "./pages/Missions";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="missions" element={<Missions />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="demo" element={<Demo />} />
      </Route>
    </Routes>
  );
}
