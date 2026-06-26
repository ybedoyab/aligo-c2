import { useEffect, useState } from "react";

interface LedState {
  on?: boolean;
  brightness?: number;
  blinking?: boolean;
}

export function IoTCircuit({ led }: { led: LedState }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!led.blinking) {
      setPulse(led.on ?? false);
      return;
    }
    const id = setInterval(() => setPulse((p) => !p), 250);
    return () => clearInterval(id);
  }, [led.blinking, led.on]);

  const glow = led.blinking ? pulse : led.on;
  const brightness = Math.max(0, Math.min(100, led.brightness ?? (glow ? 80 : 0)));

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 520 220" className="w-full max-w-2xl mx-auto" aria-label="Simulated IoT circuit">
        <defs>
          <filter id="ledGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* MCU */}
        <rect x="20" y="60" width="120" height="80" rx="6" fill="#1e293b" stroke="#475569" />
        <text x="80" y="95" textAnchor="middle" fill="#94a3b8" fontSize="11">
          IoT Device
        </text>
        <text x="80" y="112" textAnchor="middle" fill="#64748b" fontSize="9">
          Controller (sim)
        </text>

        {/* Wires MCU → resistor */}
        <line x1="140" y1="100" x2="200" y2="100" stroke="#64748b" strokeWidth="2" />
        {/* Resistor */}
        <path
          d="M200 100 h20 l8 -12 h24 l8 12 h24 l8 -12 h24 l8 12 h20"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
        />
        <line x1="304" y1="100" x2="340" y2="100" stroke="#64748b" strokeWidth="2" />

        {/* LED */}
        <circle
          cx="360"
          cy="100"
          r="18"
          fill={glow ? `rgba(34,197,94,${0.35 + brightness / 200})` : "#1e293b"}
          stroke={glow ? "#22c55e" : "#475569"}
          strokeWidth="2"
          filter={glow ? "url(#ledGlow)" : undefined}
        />
        <line x1="378" y1="100" x2="400" y2="100" stroke="#64748b" strokeWidth="2" />
        <line x1="400" y1="100" x2="400" y2="130" stroke="#64748b" strokeWidth="2" />
        <line x1="400" y1="130" x2="360" y2="130" stroke="#64748b" strokeWidth="2" />
        <line x1="360" y1="130" x2="360" y2="118" stroke="#64748b" strokeWidth="2" />
        <text x="360" y="155" textAnchor="middle" fill="#94a3b8" fontSize="10">
          LED-001
        </text>

        {/* Sensor board icons */}
        <g transform="translate(20, 160)">
          <SensorChip x={0} label="temp-001" color="#38bdf8" />
          <SensorChip x={110} label="humidity" color="#22d3ee" />
          <SensorChip x={220} label="motion" color="#a78bfa" />
          <SensorChip x={330} label="light" color="#fbbf24" />
        </g>
      </svg>
      <p className="text-center text-xs text-soc-muted">
        Simulated IoT circuit — no physical hardware required.
      </p>
    </div>
  );
}

function SensorChip({ x, label, color }: { x: number; label: string; color: string }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect width="90" height="36" rx="4" fill="#0f172a" stroke={color} strokeWidth="1" />
      <text x="45" y="22" textAnchor="middle" fill={color} fontSize="9">
        {label}
      </text>
    </g>
  );
}
