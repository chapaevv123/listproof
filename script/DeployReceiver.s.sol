// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../contracts/ListProof.sol";

interface VmReceiverDeploy {
    function envAddress(string calldata name) external returns (address);
    function envBytes32(string calldata name) external returns (bytes32);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploy only after the real workflow ID and official Sepolia forwarder are verified.
contract DeployReceiver {
    VmReceiverDeploy constant vm = VmReceiverDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (ListProofCREReceiver receiver) {
        require(block.chainid == 11155111, "Sepolia only");
        address registry = vm.envAddress("LISTPROOF_REGISTRY");
        address forwarder = vm.envAddress("LISTPROOF_FORWARDER");
        bytes32 workflowId = vm.envBytes32("LISTPROOF_WORKFLOW_ID");
        require(registry.code.length > 0 && forwarder.code.length > 0 && workflowId != 0, "bad receiver inputs");
        vm.startBroadcast();
        receiver = new ListProofCREReceiver(ListProofRegistry(registry), forwarder, workflowId);
        vm.stopBroadcast();
    }
}
