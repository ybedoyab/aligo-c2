// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ExecutionLedger
/// @notice Proof-of-Execution ledger for the Aligo Mission Ledger C2 lab project.
/// @dev Stores only hashes + metadata for execution events. No raw outputs or
///      sensitive data are ever written on-chain.
contract ExecutionLedger {
    struct LedgerEvent {
        string eventId;
        string missionId;
        string taskId;
        string nodeId;
        string eventType;
        bytes32 payloadHash;
        bytes32 previousHash;
        uint256 timestamp;
        bool exists;
    }

    mapping(string => LedgerEvent) private eventsById;
    string[] private eventIds;

    event LedgerEventRegistered(
        string indexed eventIdIndexed,
        string eventId,
        string missionId,
        string taskId,
        string nodeId,
        string eventType,
        bytes32 payloadHash,
        bytes32 previousHash,
        uint256 timestamp
    );

    error EventAlreadyExists(string eventId);
    error EventNotFound(string eventId);

    /// @notice Register a new execution event. Reverts if the eventId already exists.
    function registerEvent(
        string calldata eventId,
        string calldata missionId,
        string calldata taskId,
        string calldata nodeId,
        string calldata eventType,
        bytes32 payloadHash,
        bytes32 previousHash,
        uint256 timestamp
    ) external {
        if (eventsById[eventId].exists) {
            revert EventAlreadyExists(eventId);
        }

        eventsById[eventId] = LedgerEvent({
            eventId: eventId,
            missionId: missionId,
            taskId: taskId,
            nodeId: nodeId,
            eventType: eventType,
            payloadHash: payloadHash,
            previousHash: previousHash,
            timestamp: timestamp,
            exists: true
        });
        eventIds.push(eventId);

        emit LedgerEventRegistered(
            eventId,
            eventId,
            missionId,
            taskId,
            nodeId,
            eventType,
            payloadHash,
            previousHash,
            timestamp
        );
    }

    /// @notice Fetch a stored event by id.
    function getEvent(string calldata eventId)
        external
        view
        returns (
            string memory missionId,
            string memory taskId,
            string memory nodeId,
            string memory eventType,
            bytes32 payloadHash,
            bytes32 previousHash,
            uint256 timestamp
        )
    {
        LedgerEvent storage e = eventsById[eventId];
        if (!e.exists) {
            revert EventNotFound(eventId);
        }
        return (
            e.missionId,
            e.taskId,
            e.nodeId,
            e.eventType,
            e.payloadHash,
            e.previousHash,
            e.timestamp
        );
    }

    /// @notice Total number of registered events.
    function getEventCount() external view returns (uint256) {
        return eventIds.length;
    }

    /// @notice Get the eventId stored at a given index.
    function getEventIdAt(uint256 index) external view returns (string memory) {
        require(index < eventIds.length, "index out of range");
        return eventIds[index];
    }

    /// @notice Returns true if the supplied hash matches the stored payload hash.
    function verifyEventHash(string calldata eventId, bytes32 payloadHash)
        external
        view
        returns (bool)
    {
        LedgerEvent storage e = eventsById[eventId];
        if (!e.exists) {
            return false;
        }
        return e.payloadHash == payloadHash;
    }

    /// @notice Convenience helper: does an event with this id exist?
    function eventExists(string calldata eventId) external view returns (bool) {
        return eventsById[eventId].exists;
    }
}
