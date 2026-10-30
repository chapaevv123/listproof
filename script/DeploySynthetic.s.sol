// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../contracts/ListProof.sol";

interface VmDeploy {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Owner-run Sepolia deployment. Signing is supplied by Foundry CLI, never by source code.
contract DeploySynthetic {
    VmDeploy constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ID = 0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed;

    function run() external returns (ListProofRegistry registry, ListProofGate gate) {
        require(block.chainid == 11155111, "Sepolia only");
        address publisher = vm.envAddress("LISTPROOF_PUBLISHER");
        require(publisher != address(0), "publisher required");
        vm.startBroadcast();
        registry = new ListProofRegistry(ID, publisher);
        gate = new ListProofGate(registry);
        vm.stopBroadcast();
    }
}
