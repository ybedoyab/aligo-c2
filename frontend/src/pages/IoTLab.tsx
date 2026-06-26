import { useMemo } from "react";
import { useC2 } from "../store";
import { IoTLabView } from "./IoTLabView";

const GATEWAY_ID = "gateway-sim-001";

export function IoTLab() {
  const { nodes, iotTelemetry } = useC2();
  const gateway = nodes.find((n) => n.id === GATEWAY_ID);

  const ledState = useMemo(() => {
    const devices = iotTelemetry?.devices ?? gateway?.iot_devices ?? [];
    const led = devices.find((d) => d.device_id === "led-001");
    return (led?.state ?? {}) as { on?: boolean; brightness?: number; blinking?: boolean };
  }, [iotTelemetry, gateway?.iot_devices]);

  return <IoTLabView ledState={ledState} />;
}
