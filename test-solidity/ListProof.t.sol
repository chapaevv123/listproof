// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../contracts/ListProof.sol";
import "./GeneratedProofFixture.sol";

interface Vm { function chainId(uint256) external; function prank(address) external; }
contract ListProofTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    ListProofRegistry registry;
    ListProofGate gate;
    bytes32 constant ROOT1 = 0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888;
    bytes32 constant ROOT2 = 0xd85061ea6396f625770449c26ddd3d76a429bfe475f2ad7fb046e25ce529fc31;
    bytes32 constant ID = 0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed;
    function setUp() public {
        vm.chainId(11155111);
        registry = new ListProofRegistry(ID, address(this));
        registry.publish(1, ROOT1, bytes32(uint256(1)), 3);
        gate = new ListProofGate(registry);
    }
    function proof() internal pure returns (ListProofVerifier.NonMember memory p) {
        return GeneratedProofFixture.middle();
    }
    function failTransfer(ListProofVerifier.NonMember memory p, uint256 nonce) internal {
        (bool ok,) = address(gate).call(abi.encodeCall(ListProofGate.transfer, (address(6), 1, nonce, p)));
        require(!ok, "unexpected transfer success");
    }
    function testValidAndReplay() public {
        gate.transfer(address(6),10,0,proof());
        require(gate.balanceOf(address(6))==10 && gate.nonces(address(this))==1,"state");
        failTransfer(proof(),0);
        failTransfer(proof(),1);
    }
    function testListedAndForged() public {
        ListProofVerifier.NonMember memory p=proof();p.target=address(5);
        (bool listedOk,) = address(gate).call(abi.encodeCall(ListProofGate.transfer, (address(5),1,0,p)));
        require(!listedOk,"listed accepted");
        p=proof();p.left.siblings[0]=bytes32(0);failTransfer(p,0);
        p=proof();p.right.index=1;failTransfer(p,0);
        p=proof();p.root=bytes32(uint256(9));failTransfer(p,0);
    }
    function testStaleAndPublisher() public {
        vm.prank(address(9));
        (bool publishOk,) = address(registry).call(abi.encodeCall(ListProofRegistry.publish, (2,ROOT2,bytes32(uint256(2)),4)));
        require(!publishOk,"unauthorized publish accepted");
        registry.publish(2,ROOT2,bytes32(uint256(2)),4);
        failTransfer(proof(),0);
    }
    function testLowerAndUpperBoundaries() public {
        ListProofVerifier.NonMember memory low=proof();
        low.target=address(1);low.hasLeft=false;low.right.account=address(2);low.right.index=0;
        low.right.siblings=new bytes32[](2);
        low.right.siblings[0]=0x5df64b869223d8133bc59d6c72d3a4385f9296db2f9971f2936fc118b0108a03;
        low.right.siblings[1]=0x25b00843867030251b425f16450640fade50f18d70b0ba645505fc4c6dc8c287;
        gate.transfer(address(1),1,0,low);
        ListProofVerifier.NonMember memory high=proof();
        high.target=address(10);high.hasRight=false;high.left=high.right;
        gate.transfer(address(10),1,1,high);
        require(gate.balanceOf(address(1))==1 && gate.balanceOf(address(10))==1,"boundaries");
    }
    function testMalformedProofs() public {
        ListProofVerifier.NonMember memory p=proof();p.left.siblings=new bytes32[](0);failTransfer(p,0);
        p=proof();p.right.siblings=new bytes32[](2);failTransfer(p,0);
        p=proof();p.hasLeft=false;p.hasRight=false;failTransfer(p,0);
        p=proof();p.count=4;failTransfer(p,0);
        p=proof();p.target=address(7);p.right.account=address(5);failTransfer(p,0);
    }
    function testCREReceiver() public {
        address mockForwarder=address(0xBEEF);bytes32 workflow=bytes32(uint256(77));
        ListProofCREReceiver receiver=new ListProofCREReceiver(registry,mockForwarder,workflow);
        registry.transferPublisher(address(receiver));
        bytes memory metadata=new bytes(64);assembly { mstore(add(metadata,32),workflow) }
        bytes memory payload=abi.encode(uint256(11155111),ID,uint256(2),ROOT2,bytes32(uint256(2)),uint256(4));
        (bool unauthorizedOk,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport, (metadata,payload)));
        require(!unauthorizedOk,"unauthorized receiver call accepted");
        vm.prank(mockForwarder);receiver.onReport(metadata,payload);
        require(registry.epoch()==2 && registry.root()==ROOT2,"receiver update");
        vm.prank(mockForwarder);
        (bool replayOk,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport, (metadata,payload)));
        require(!replayOk,"replayed report accepted");
    }
    function testCREReceiverRejectsBadMetadataAndDomain() public {
        address forwarder=address(0xBEEF); bytes32 workflow=bytes32(uint256(77));
        ListProofCREReceiver receiver=new ListProofCREReceiver(registry,forwarder,workflow);
        registry.transferPublisher(address(receiver));
        bytes memory metadata=new bytes(64);
        bytes memory payload=abi.encode(uint256(11155111),ID,uint256(2),ROOT2,bytes32(uint256(2)),uint256(4));
        vm.prank(forwarder);
        (bool wrongWorkflow,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport,(metadata,payload)));
        require(!wrongWorkflow,"wrong workflow accepted");
        assembly { mstore(add(metadata,32),workflow) }
        bytes memory shortMetadata=new bytes(32);
        vm.prank(forwarder);
        (bool malformed,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport,(shortMetadata,payload)));
        require(!malformed,"short metadata accepted");
        bytes memory wrongChain=abi.encode(uint256(1),ID,uint256(2),ROOT2,bytes32(uint256(2)),uint256(4));
        vm.prank(forwarder);
        (bool chainOk,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport,(metadata,wrongChain)));
        require(!chainOk,"wrong chain accepted");
        bytes memory wrongDataset=abi.encode(uint256(11155111),bytes32(uint256(1)),uint256(2),ROOT2,bytes32(uint256(2)),uint256(4));
        vm.prank(forwarder);
        (bool datasetOk,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport,(metadata,wrongDataset)));
        require(!datasetOk,"wrong dataset accepted");
        bytes memory malformedReport = hex"01";
        vm.prank(forwarder);
        (bool shortReport,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport,(metadata,malformedReport)));
        require(!shortReport,"short report accepted");
        bytes memory skippedEpoch=abi.encode(uint256(11155111),ID,uint256(3),ROOT2,bytes32(uint256(2)),uint256(4));
        vm.prank(forwarder);
        (bool skipOk,) = address(receiver).call(abi.encodeCall(ListProofCREReceiver.onReport,(metadata,skippedEpoch)));
        require(!skipOk,"skipped epoch accepted");
        require(registry.epoch()==1,"invalid report changed registry");
    }
}
