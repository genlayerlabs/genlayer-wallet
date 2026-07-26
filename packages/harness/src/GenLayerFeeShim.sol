// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GenLayerFeeShim {
    uint256 public transactionCount;

    struct FeesDistribution {
        uint256 leaderTimeunitsAllocation;
        uint256 validatorTimeunitsAllocation;
        uint256 appealRounds;
        uint256 executionBudgetPerRound;
        uint256 executionConsumed;
        uint256 totalMessageFees;
        uint256[] rotations;
        uint256 maxPriceGenPerTimeUnit;
        uint256 storageFeeMaxGasPrice;
        uint256 receiptFeeMaxGasPrice;
    }

    struct MessageFeeAllocationNode {
        uint8 messageType;
        bool onAcceptance;
        uint256 parentIndex;
        address recipient;
        bytes32 callKey;
        uint256 budget;
        bytes feeParams;
    }

    struct AddTransactionParams {
        address sender;
        address recipient;
        uint256 numOfInitialValidators;
        uint256 maxRotations;
        uint256 validUntil;
        uint256 saltNonce;
        uint256 userValue;
        FeesDistribution feesDistribution;
        bytes txCalldata;
        MessageFeeAllocationNode[] messageAllocations;
    }

    struct TransactionRecord {
        address sender;
        address submittedBy;
        address recipient;
        uint256 userValue;
        uint256 msgValue;
        bytes32 feeConfigHash;
        bytes32 txCalldataHash;
        uint256 createdAt;
    }

    mapping(bytes32 txId => TransactionRecord record) public transactions;

    event GenLayerTransactionCreated(
        bytes32 indexed txId,
        address indexed sender,
        address indexed recipient,
        bytes32 feeConfigHash,
        uint256 userValue,
        uint256 msgValue
    );

    event FeeConfigSubmitted(
        bytes32 indexed txId,
        uint256 numOfInitialValidators,
        uint256 maxRotations,
        uint256 appealRounds,
        uint256 rotationsCount,
        uint256 messageAllocationsCount,
        uint256 maxPriceGenPerTimeUnit,
        bytes32 txCalldataHash
    );

    function addTransaction(
        AddTransactionParams calldata params
    ) external payable returns (bytes32 txId) {
        require(params.sender != address(0), "GENLAYER_SHIM_ZERO_SENDER");
        require(params.validUntil >= block.timestamp, "GENLAYER_SHIM_EXPIRED");
        require(msg.value >= params.userValue, "GENLAYER_SHIM_VALUE_TOO_LOW");

        bytes32 feeConfigHash = hashFeeConfig(params);
        bytes32 txCalldataHash = keccak256(params.txCalldata);

        transactionCount += 1;
        txId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                transactionCount,
                params.sender,
                params.recipient,
                params.saltNonce,
                txCalldataHash,
                feeConfigHash
            )
        );

        transactions[txId] = TransactionRecord({
            sender: params.sender,
            submittedBy: msg.sender,
            recipient: params.recipient,
            userValue: params.userValue,
            msgValue: msg.value,
            feeConfigHash: feeConfigHash,
            txCalldataHash: txCalldataHash,
            createdAt: block.timestamp
        });

        emit GenLayerTransactionCreated(
            txId,
            params.sender,
            params.recipient,
            feeConfigHash,
            params.userValue,
            msg.value
        );

        emit FeeConfigSubmitted(
            txId,
            params.numOfInitialValidators,
            params.maxRotations,
            params.feesDistribution.appealRounds,
            params.feesDistribution.rotations.length,
            params.messageAllocations.length,
            params.feesDistribution.maxPriceGenPerTimeUnit,
            txCalldataHash
        );
    }

    function hashFeeConfig(
        AddTransactionParams calldata params
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(params.feesDistribution, params.messageAllocations));
    }
}
