import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Italic,
  Text,
  Bold,
  Section,
  Divider,
  Button,
} from '@metamask/snaps-sdk/jsx';

import type { ParsedGenLayerTransaction } from '../transactions/transaction';

export type TransactionConfigProps = {
  summary: Record<string, any> | null;
};

const displayValue = (value: string | undefined): string => value ?? 'unknown';

const allocationSummary = (
  allocation: NonNullable<
    ParsedGenLayerTransaction['messageAllocations']
  >[number],
  index: number,
): string =>
  `${index + 1}. ${allocation.messageType} ${
    allocation.onAcceptance ? 'on acceptance' : 'on finalization'
  }, budget ${allocation.budget}`;

export const TransactionConfig: SnapComponent<TransactionConfigProps> = ({
  summary,
}) => {
  const transactionSummary = summary as ParsedGenLayerTransaction | null;
  const feesDistribution = transactionSummary?.feesDistribution;
  const messageAllocations = transactionSummary?.messageAllocations ?? [];
  const messageAllocationsCount =
    transactionSummary?.messageAllocationsCount ?? 0;

  return (
    <Box>
      <Section>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>
            <Bold>Contract:</Bold>
          </Text>
          <Text>{transactionSummary?.contractAddress ?? 'unknown'}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>
            <Bold>Method:</Bold>
          </Text>
          <Text>{transactionSummary?.methodName ?? 'unknown'}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Transaction type:</Text>
          <Text>{transactionSummary?.kind ?? 'unknown'}</Text>
        </Box>
        {transactionSummary?.txId ? (
          <Box direction="horizontal" alignment={'space-between'}>
            <Text>Transaction ID:</Text>
            <Text>{transactionSummary.txId}</Text>
          </Box>
        ) : null}
        <Divider />
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>
            <Bold>User value:</Bold>
          </Text>
          <Text>{displayValue(transactionSummary?.userValue)}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Leader time units:</Text>
          <Text>
            {displayValue(feesDistribution?.leaderTimeunitsAllocation)}
          </Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Validator time units:</Text>
          <Text>
            {displayValue(feesDistribution?.validatorTimeunitsAllocation)}
          </Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Appeal rounds:</Text>
          <Text>{displayValue(feesDistribution?.appealRounds)}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Rotations:</Text>
          <Text>{feesDistribution?.rotations.join(', ') ?? 'unknown'}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Execution budget:</Text>
          <Text>{displayValue(feesDistribution?.executionBudgetPerRound)}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Total messages fees:</Text>
          <Text>{displayValue(feesDistribution?.totalMessageFees)}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Message fee mode:</Text>
          <Text>{transactionSummary?.messageAllocationMode ?? 'unknown'}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Message allocations:</Text>
          <Text>{messageAllocationsCount.toString()}</Text>
        </Box>
        {messageAllocations.map((allocation, index) => (
          <Box key={`${allocation.recipient}-${index}`}>
            <Text>{allocationSummary(allocation, index)}</Text>
            <Text>Recipient: {allocation.recipient}</Text>
            <Text>Call key: {allocation.callKey}</Text>
            <Text>Parent: {allocation.parentIndex}</Text>
          </Box>
        ))}
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Max GEN/time unit:</Text>
          <Text>{displayValue(feesDistribution?.maxPriceGenPerTimeUnit)}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Storage gas cap:</Text>
          <Text>{displayValue(feesDistribution?.storageFeeMaxGasPrice)}</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Receipt gas cap:</Text>
          <Text>{displayValue(feesDistribution?.receiptFeeMaxGasPrice)}</Text>
        </Box>
        <Divider />
        <Text>
          <Italic>
            Unused fee deposit is returned after finalization when supported by
            the active consensus version.
          </Italic>
        </Text>
      </Section>
      <Box center>
        <Button name="advanced_options">Show Advanced Options</Button>
      </Box>
    </Box>
  );
};
