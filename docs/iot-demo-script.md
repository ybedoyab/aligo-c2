# IoT demo script (jury walkthrough)

**Time:** ~3 minutes  
**Prerequisite:** `python dev.py` running (includes IoT gateway)

## 1. Show hybrid platform (30s)

1. Open **Dashboard** — note computer nodes and gateway online.
2. Open **Topology** — point out computer branch vs IoT gateway branch with nested subdevices.
3. Say: *"Mission Ledger C2 orchestrates both computer nodes and simulated IoT gateways."*

## 2. IoT Lab live view (60s)

1. Open **IoT Lab**.
2. Highlight gateway summary (policy `iot_demo_policy`, simulated badge).
3. Watch telemetry values update (temperature, humidity, motion, light).
4. Show **Circuit View** — MCU, resistor, LED-001, sensor chips.
5. Click **Turn LED on** — LED glows in circuit panel.
6. Click **Blink LED** — real-time blink animation.
7. Click **Turn LED off**.

## 3. Mission + evidence (60s)

1. Open **Demo** → **Start IoT Lab Health Check**.
2. Open **Ledger** — show TASK_SENT / TASK_RESULT events for gateway.
3. Click **Verify latest IoT event** on Demo page (or verify from evidence modal).
4. Open task evidence — show IoT summary section (gateway, subdevice, action, simulated).

## 4. Environmental + LED missions (30s)

1. **Missions** → run **Environmental Snapshot** on `gateway-sim-001`.
2. Run **LED Proof Mission** — explain each step creates anchored evidence.
3. **Export IoT evidence bundle** from Demo page.

## 5. Closing line

> *"Simulated IoT mode demonstrates how Mission Ledger C2 can orchestrate gateways, sensors, and actuators without physical hardware. Every action is executed through a connected software gateway and recorded as verifiable, blockchain-anchored evidence."*

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Gateway offline | Ensure `dev.py` started without `--no-iot` |
| Tasks blocked | Check node policy is `iot_demo_policy` on gateway |
| No ledger events | Run a mission, then anchor pending events |
