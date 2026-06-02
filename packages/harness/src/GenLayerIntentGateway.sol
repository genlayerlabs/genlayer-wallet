// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { GenLayerFeeShim } from "./GenLayerFeeShim.sol";

contract GenLayerIntentGateway {
    GenLayerFeeShim public immutable SHIM;

    mapping(address signer => uint256 nonce) public nonces;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant GENLAYER_INTENT_TYPEHASH =
        keccak256(
            "GenLayerIntent(address sender,address recipient,uint256 value,bytes32 txDataHash,uint256 numInitialValidators,uint256 maxRotations,uint256 validUntil,uint256 maxTotalFee,bytes32 feeConfigHash,uint256 nonce,uint256 deadline)"
        );
    bytes32 private constant NAME_HASH = keccak256("GenLayerIntent");
    bytes32 private constant VERSION_HASH = keccak256("0.1");

    event IntentSubmitted(
        bytes32 indexed intentHash,
        address indexed signer,
        bytes32 indexed txId,
        uint256 maxTotalFee,
        uint256 msgValue
    );

    constructor(address shimAddress) {
        require(shimAddress != address(0), "GENLAYER_GATEWAY_ZERO_SHIM");
        SHIM = GenLayerFeeShim(shimAddress);
    }

    function submitIntent(
        GenLayerFeeShim.AddTransactionParams calldata params,
        uint256 maxTotalFee,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external payable returns (bytes32 txId) {
        require(block.timestamp <= deadline, "GENLAYER_GATEWAY_EXPIRED");
        require(nonce == nonces[params.sender], "GENLAYER_GATEWAY_BAD_NONCE");
        require(msg.value >= params.userValue, "GENLAYER_GATEWAY_VALUE_TOO_LOW");
        require(
            msg.value <= params.userValue + maxTotalFee,
            "GENLAYER_GATEWAY_VALUE_TOO_HIGH"
        );

        bytes32 feeConfigHash = SHIM.hashFeeConfig(params);
        bytes32 txDataHash = keccak256(params.txCalldata);
        bytes32 intentHash = hashIntent(
            params.sender,
            params.recipient,
            params.userValue,
            txDataHash,
            params.numOfInitialValidators,
            params.maxRotations,
            params.validUntil,
            maxTotalFee,
            feeConfigHash,
            nonce,
            deadline
        );

        require(
            recoverSigner(intentHash, signature) == params.sender,
            "GENLAYER_GATEWAY_BAD_SIGNATURE"
        );

        nonces[params.sender] = nonce + 1;
        txId = SHIM.addTransaction{ value: msg.value }(params);

        emit IntentSubmitted(intentHash, params.sender, txId, maxTotalFee, msg.value);
    }

    function hashIntent(
        address sender,
        address recipient,
        uint256 value,
        bytes32 txDataHash,
        uint256 numInitialValidators,
        uint256 maxRotations,
        uint256 validUntil,
        uint256 maxTotalFee,
        bytes32 feeConfigHash,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                GENLAYER_INTENT_TYPEHASH,
                sender,
                recipient,
                value,
                txDataHash,
                numInitialValidators,
                maxRotations,
                validUntil,
                maxTotalFee,
                feeConfigHash,
                nonce,
                deadline
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function domainSeparator() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    NAME_HASH,
                    VERSION_HASH,
                    block.chainid,
                    address(this)
                )
            );
    }

    function recoverSigner(
        bytes32 digest,
        bytes calldata signature
    ) public pure returns (address) {
        require(signature.length == 65, "GENLAYER_GATEWAY_BAD_SIG_LENGTH");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "GENLAYER_GATEWAY_BAD_SIG_V");
        return ecrecover(digest, v, r, s);
    }
}
