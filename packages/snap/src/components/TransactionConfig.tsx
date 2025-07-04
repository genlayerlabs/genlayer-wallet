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

export const TransactionConfig: SnapComponent = () => {
  return (
    <Box>
      <Section>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>
            <Bold>Estimated Fee Range:</Bold>
          </Text>
          <Text color={'error'}>
            <Italic>0.5 to 5.06 GEN</Italic>
          </Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Leader timeout:</Text>
          <Text>~1 minute</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Validator timeout:</Text>
          <Text>~30 seconds</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Appeal rounds:</Text>
          <Text>2</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>GenLayer storage cost:</Text>
          <Text>0.01 GEN</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Rollup storage cost:</Text>
          <Text>0.01 GEN</Text>
        </Box>
        <Box direction="horizontal" alignment={'space-between'}>
          <Text>Total messages fees:</Text>
          <Text>0.9 GEN</Text>
        </Box>
        <Divider />
        <Text>
          Note: Unused GEN will be returned to your account once the transaction
          is finalized.
        </Text>
      </Section>
      <Box center>
        <Button name="advanced_options">Show Advanced Options</Button>
      </Box>
    </Box>
  );
};
