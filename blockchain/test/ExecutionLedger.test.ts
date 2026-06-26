import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExecutionLedger", () => {
  async function deploy() {
    const Factory = await ethers.getContractFactory("ExecutionLedger");
    const ledger = await Factory.deploy();
    await ledger.waitForDeployment();
    return ledger;
  }

  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("payload"));
  const previousHash = ethers.ZeroHash;

  it("registers an event and exposes it via getEvent", async () => {
    const ledger = await deploy();
    await ledger.registerEvent(
      "evt-1",
      "mission-1",
      "task-1",
      "agent-001",
      "TASK_RESULT",
      payloadHash,
      previousHash,
      1000
    );

    expect(await ledger.getEventCount()).to.equal(1n);
    expect(await ledger.getEventIdAt(0)).to.equal("evt-1");

    const event = await ledger.getFunction("getEvent")("evt-1");
    expect(event.missionId).to.equal("mission-1");
    expect(event.taskId).to.equal("task-1");
    expect(event.agentId).to.equal("agent-001");
    expect(event.eventType).to.equal("TASK_RESULT");
    expect(event.payloadHash).to.equal(payloadHash);
    expect(event.timestamp).to.equal(1000n);
  });

  it("emits LedgerEventRegistered on registration", async () => {
    const ledger = await deploy();
    await expect(
      ledger.registerEvent(
        "evt-2",
        "mission-1",
        "task-2",
        "agent-002",
        "TASK_SENT",
        payloadHash,
        previousHash,
        2000
      )
    )
      .to.emit(ledger, "LedgerEventRegistered")
      .withArgs(
        "evt-2",
        "evt-2",
        "mission-1",
        "task-2",
        "agent-002",
        "TASK_SENT",
        payloadHash,
        previousHash,
        2000
      );
  });

  it("rejects duplicate event ids", async () => {
    const ledger = await deploy();
    await ledger.registerEvent(
      "evt-dup",
      "m",
      "t",
      "a",
      "TASK_RESULT",
      payloadHash,
      previousHash,
      1
    );
    await expect(
      ledger.registerEvent(
        "evt-dup",
        "m",
        "t",
        "a",
        "TASK_RESULT",
        payloadHash,
        previousHash,
        1
      )
    ).to.be.revertedWithCustomError(ledger, "EventAlreadyExists");
  });

  it("verifies matching and mismatching payload hashes", async () => {
    const ledger = await deploy();
    await ledger.registerEvent(
      "evt-3",
      "m",
      "t",
      "a",
      "TASK_RESULT",
      payloadHash,
      previousHash,
      1
    );

    expect(await ledger.verifyEventHash("evt-3", payloadHash)).to.equal(true);

    const tampered = ethers.keccak256(ethers.toUtf8Bytes("tampered"));
    expect(await ledger.verifyEventHash("evt-3", tampered)).to.equal(false);
    // Unknown event ids verify to false rather than reverting.
    expect(await ledger.verifyEventHash("missing", payloadHash)).to.equal(false);
  });

  it("reverts getEvent for unknown ids", async () => {
    const ledger = await deploy();
    await expect(ledger.getFunction("getEvent")("nope")).to.be.revertedWithCustomError(
      ledger,
      "EventNotFound"
    );
  });
});
