import { useMemo } from "react";
import { IOT_DEVICE_ID, IOT_GATEWAY_ID } from "../constants/iot";
import { useC2 } from "../store";
import { IoTLabView } from "./IoTLabView";


export function IoTLab() {
  const { nodes, iotTelemetry } = useC2();
  const gateway = nodes.find((n) => n.id === IOT_GATEWAY_ID);

  const ledState = useMemo(() => {
    const devices = iotTelemetry?.devices ?? gateway?.iot_devices ?? [];
    const led = devices.find((d) => d.device_id === IOT_DEVICE_ID.LED);
    return (led?.state ?? {}) as { on?: boolean; brightness?: number; blinking?: boolean };
  }, [iotTelemetry, gateway?.iot_devices]);

  return <IoTLabView ledState={ledState} />;
}
