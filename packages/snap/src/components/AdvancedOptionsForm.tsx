import type { SnapComponent } from '@metamask/snaps-sdk/jsx';
import {
  Section,
  Button,
  Box,
  Dropdown,
  Field,
  Heading,
  Form,
  Input,
  Option,
} from '@metamask/snaps-sdk/jsx';

import type { FeeConfigState } from '../types';

export type AdvancedOptionsFormProps = {
  values: FeeConfigState;
};

export const AdvancedOptionsForm: SnapComponent<AdvancedOptionsFormProps> = ({
  values,
}) => {
  const numberOfAppeals = parseInt(values['number-of-appeals'] ?? '1', 10);
  return (
    <Box>
      <Section>
        <Heading>Advanced Options</Heading>
        <Form name="advanced-options-form">
          <Field label="Number of Appeals">
            <Dropdown
              name="number-of-appeals"
              value={values['number-of-appeals'] ?? ''}
            >
              <Option value="1">1</Option>
              <Option value="2">2</Option>
              <Option value="3">3</Option>
              <Option value="4">4</Option>
              <Option value="5">5</Option>
              <Option value="6">6</Option>
              <Option value="7">7</Option>
            </Dropdown>
          </Field>
          {Array.from({ length: numberOfAppeals }).map((_, index) => {
            const roundNumber = index + 1;
            const fieldName = `rotations-in-round-${roundNumber}`;
            return (
              <Field
                key={fieldName}
                label={`Rotations in Round ${roundNumber}`}
              >
                <Input
                  name={fieldName}
                  type="number"
                  min={1}
                  placeholder={`Enter rotations for Round ${roundNumber}`}
                  value={values[fieldName] ?? ''}
                />
              </Field>
            );
          })}
          <Field label="Leader Timeout (seconds)">
            <Input
              name="leader-timeout-input"
              type={'number'}
              min={1}
              placeholder="60 Sec"
              value={values['leader-timeout-input'] ?? ''}
            />
          </Field>
          <Field label="Validator Timeout (seconds)">
            <Input
              name="validator-timeout-input"
              type={'number'}
              min={1}
              placeholder="30 Sec"
              value={values['validator-timeout-input'] ?? ''}
            />
          </Field>
          <Field label="Max. Genlayer Storage (GEN)">
            <Input
              name="genlayer-storage-input"
              type={'number'}
              placeholder="12 GEN"
              value={values['genlayer-storage-input'] ?? ''}
            />
          </Field>
          <Field label="Max. Rollup Storage (GEN)">
            <Input
              name="rollup-storage-input"
              type={'number'}
              placeholder="12 GEN"
              value={values['rollup-storage-input'] ?? ''}
            />
          </Field>
          <Field label="Message gas configuration">
            <Input
              name="message-gas-input"
              placeholder="JSON here (Editable)"
              value={values['message-gas-input'] ?? ''}
            />
          </Field>
          <Box direction={'horizontal'} alignment={'center'}>
            <Button variant={'destructive'} name="cancel_config">
              Cancel
            </Button>
            <Button type="submit" name="save_config">
              Save
            </Button>
          </Box>
        </Form>
      </Section>
    </Box>
  );
};
