// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Demonstration only. Publisher is trusted for dataset selection and root updates.
contract ListProofRegistry {
    address public publisher;
    bytes32 public immutable datasetId;
    bytes32 public root;
    bytes32 public contentHash;
    uint256 public epoch;
    uint256 public count;
    event RootUpdated(uint256 indexed epoch, bytes32 root, bytes32 contentHash, uint256 count);

    constructor(bytes32 _datasetId, address _publisher) {
        require(_datasetId != 0 && _publisher != address(0), "invalid init");
        datasetId = _datasetId;
        publisher = _publisher;
    }
    function transferPublisher(address next) external {
        require(msg.sender == publisher && next != address(0), "publisher");
        publisher = next;
    }
    function publish(uint256 nextEpoch, bytes32 nextRoot, bytes32 nextContentHash, uint256 nextCount) external {
        require(msg.sender == publisher, "publisher");
        require(nextEpoch == epoch + 1 && nextRoot != 0 && nextContentHash != 0 && nextCount > 0, "invalid update");
        epoch = nextEpoch; root = nextRoot; contentHash = nextContentHash; count = nextCount;
        emit RootUpdated(nextEpoch, nextRoot, nextContentHash, nextCount);
    }
}

interface IERC165ListProof { function supportsInterface(bytes4 interfaceId) external view returns (bool); }
interface ICREReceiverListProof is IERC165ListProof { function onReport(bytes calldata metadata, bytes calldata report) external; }

/// @notice CRE receiver. Configure it as registry publisher after deploying and verifying the workflow.
/// @dev Production forwarder metadata is 64 bytes: workflowId (32), name (10), owner (20), reportId (2).
contract ListProofCREReceiver is ICREReceiverListProof {
    ListProofRegistry public immutable registry;
    address public immutable forwarder;
    bytes32 public immutable workflowId;

    constructor(ListProofRegistry _registry, address _forwarder, bytes32 _workflowId) {
        require(address(_registry) != address(0) && _forwarder != address(0) && _workflowId != 0, "receiver init");
        registry = _registry; forwarder = _forwarder; workflowId = _workflowId;
    }
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(ICREReceiverListProof).interfaceId || interfaceId == type(IERC165ListProof).interfaceId;
    }
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        require(msg.sender == forwarder && metadata.length == 64, "forwarder");
        bytes32 id;
        assembly { id := calldataload(metadata.offset) }
        require(id == workflowId, "workflow");
        (uint256 chainId, bytes32 datasetId, uint256 epoch, bytes32 root, bytes32 contentHash, uint256 count) =
            abi.decode(report, (uint256, bytes32, uint256, bytes32, bytes32, uint256));
        require(chainId == block.chainid && datasetId == registry.datasetId(), "domain");
        registry.publish(epoch, root, contentHash, count);
    }
}

library ListProofVerifier {
    struct Member { address account; uint256 index; bytes32[] siblings; }
    struct NonMember { uint256 epoch; bytes32 root; uint256 count; address target; bool hasLeft; Member left; bool hasRight; Member right; }
    function leaf(uint256 chainId, bytes32 datasetId, uint256 epoch, address account) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(bytes1(0x00), chainId, datasetId, epoch, account));
    }
    function parent(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(bytes1(0x01), a, b));
    }
    function member(bytes32 root, uint256 chainId, bytes32 datasetId, uint256 epoch, uint256 count, Member calldata p) internal pure returns (bool) {
        if (count == 0 || p.index >= count) return false;
        bytes32 h = leaf(chainId, datasetId, epoch, p.account);
        uint256 i = p.index; uint256 n = count; uint256 k;
        while (n > 1) {
            uint256 other = i ^ 1;
            if (other < n) {
                if (k >= p.siblings.length) return false;
                bytes32 sibling = p.siblings[k++];
                h = (i & 1) == 1 ? parent(sibling, h) : parent(h, sibling);
            }
            i /= 2; n = (n + 1) / 2;
        }
        return k == p.siblings.length && h == root;
    }
    function absent(ListProofRegistry registry, NonMember calldata p) internal view returns (bool) {
        if (p.epoch != registry.epoch() || p.root != registry.root() || p.count != registry.count()) return false;
        if (!p.hasLeft && !p.hasRight) return false;
        uint256 chainId = block.chainid; bytes32 id = registry.datasetId();
        if (p.hasLeft && (!member(p.root, chainId, id, p.epoch, p.count, p.left) || uint160(p.left.account) >= uint160(p.target))) return false;
        if (p.hasRight && (!member(p.root, chainId, id, p.epoch, p.count, p.right) || uint160(p.target) >= uint160(p.right.account))) return false;
        if (p.hasLeft && p.hasRight) return p.left.index + 1 == p.right.index;
        if (p.hasLeft) return p.left.index == p.count - 1;
        return p.right.index == 0;
    }
}

/// @notice Test-only ledger, not an ERC20 or a production transfer policy.
contract ListProofGate {
    ListProofRegistry public immutable registry;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public usedEvidence;
    event Transfer(address indexed from, address indexed to, uint256 amount, uint256 epoch);
    constructor(ListProofRegistry _registry) { registry = _registry; balanceOf[msg.sender] = 1000; }
    function transfer(address to, uint256 amount, uint256 nonce, ListProofVerifier.NonMember calldata proof) external {
        require(to != address(0) && to == proof.target, "target");
        require(nonce == nonces[msg.sender], "replay");
        require(ListProofVerifier.absent(registry, proof), "proof");
        bytes32 evidenceId = keccak256(abi.encode(msg.sender, to, proof.epoch, proof.root));
        require(!usedEvidence[evidenceId], "evidence replay");
        require(amount > 0 && balanceOf[msg.sender] >= amount, "balance");
        usedEvidence[evidenceId] = true;
        nonces[msg.sender] = nonce + 1;
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount, proof.epoch);
    }
}
