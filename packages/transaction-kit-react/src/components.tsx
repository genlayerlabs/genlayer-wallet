import React, { useCallback, useMemo, useRef, useState } from 'react';
import type {
  FeePreset,
  PolicyQuote,
  SubmitInput,
  TrackedStatus,
  TransactionKit,
} from './contract';
import { describeError, describeOutcome, formatGen, shortHash } from './format';
import { useTransactionFlow } from './useTransactionFlow';

const PRESET_COPY: Record<FeePreset, { label: string; sub: string }> = {
  low: { label: 'Low', sub: 'no appeals' },
  standard: { label: 'Standard', sub: '1 appeal round' },
  high: { label: 'High', sub: '2 appeal rounds' },
};

function Gen({ wei, busy }: { wei: bigint; busy?: boolean }) {
  return (
    <span className="gltk-total-value" data-busy={busy ? 'true' : undefined}>
      {formatGen(wei)}
      <span className="gltk-unit">GEN</span>
    </span>
  );
}

function ReceiptRow(props: { label: string; hint?: string; wei: bigint }) {
  return (
    <div className="gltk-row">
      <span className="gltk-row-label">
        {props.label}
        {props.hint ? <span className="gltk-row-hint">{props.hint}</span> : null}
      </span>
      <span className="gltk-row-value">
        {formatGen(props.wei)}
        <span className="gltk-unit">GEN</span>
      </span>
    </div>
  );
}

export function FeeReceipt({ quote, busy }: { quote: PolicyQuote; busy?: boolean }) {
  return (
    <div className="gltk-receipt">
      <ReceiptRow
        label="Consensus work"
        hint="leader + validators, per round"
        wei={quote.breakdown.timeUnitFees}
      />
      <ReceiptRow
        label="Execution budget"
        hint="storage + receipt writes"
        wei={quote.breakdown.executionBudget}
      />
      {quote.breakdown.messageFees > 0n ? (
        <ReceiptRow label="Message budget" hint="child transactions" wei={quote.breakdown.messageFees} />
      ) : null}
      {quote.userValue > 0n ? (
        <ReceiptRow label="Value sent" hint="delivered to the contract" wei={quote.userValue} />
      ) : null}
      <div className="gltk-total">
        <span className="gltk-total-label">Total deposit</span>
        <Gen wei={quote.total} busy={busy} />
      </div>
      <p className="gltk-refundable">Unused amounts are refunded when the transaction finalizes.</p>
    </div>
  );
}

export function PresetSelector(props: {
  value: FeePreset;
  onChange: (p: FeePreset) => void;
  disabled?: boolean;
}) {
  return (
    <div className="gltk-presets" role="radiogroup" aria-label="Fee preset">
      {(Object.keys(PRESET_COPY) as FeePreset[]).map((preset) => (
        <button
          key={preset}
          type="button"
          role="radio"
          aria-checked={props.value === preset}
          className="gltk-preset"
          data-active={props.value === preset ? 'true' : undefined}
          disabled={props.disabled}
          onClick={() => props.onChange(preset)}
        >
          {PRESET_COPY[preset].label}
          <small>{PRESET_COPY[preset].sub}</small>
        </button>
      ))}
    </div>
  );
}

export function CapsShield({ quote }: { quote: PolicyQuote }) {
  return (
    <div className="gltk-caps">
      <div className="gltk-caps-title">Price protection</div>
      <div className="gltk-caps-grid">
        <span className="gltk-cap">
          Time-unit price cap <b>{formatGen(quote.caps.genPerTimeUnit)} GEN</b>
        </span>
        <span className="gltk-cap">
          Storage price cap <b>{quote.caps.storagePrice.toString()} wei</b>
        </span>
        <span className="gltk-cap">
          Receipt gas cap <b>{quote.caps.receiptPrice.toString()} wei</b>
        </span>
      </div>
      <p className="gltk-caps-note">
        If network prices rise above any cap, the transaction is rejected and nothing is charged.
      </p>
    </div>
  );
}

export function VerifyBadge(props: {
  feeConfigHash?: string;
  snapState?: 'verified' | 'unavailable';
}) {
  if (!props.feeConfigHash) return null;
  const verified = props.snapState === 'verified';
  return (
    <div className="gltk-verify" data-state={verified ? 'verified' : undefined}>
      <span>{verified ? '✓ Verified by GenLayer Snap' : 'Policy fingerprint'}</span>
      <code>{shortHash(props.feeConfigHash, 10, 6)}</code>
    </div>
  );
}

/** Press-and-hold approval — a deliberate action, not a misclick. */
export function HoldToSign(props: {
  onConfirm: () => void;
  disabled?: boolean;
  holdMs?: number;
  label?: string;
}) {
  const holdMs = props.holdMs ?? 900;
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const start = useCallback(() => {
    if (props.disabled) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      props.onConfirm();
    }, holdMs);
  }, [props, holdMs]);

  const cancel = useCallback(() => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      className="gltk-hold"
      data-holding={holding ? 'true' : undefined}
      style={{ ['--gltk-hold-ms' as never]: `${holdMs}ms` }}
      disabled={props.disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          props.onConfirm(); // keyboard users confirm directly
        }
      }}
    >
      <span className="gltk-hold-fill" aria-hidden />
      {props.label ?? 'Approve & sign'}
      <span className="gltk-hold-hint">hold to confirm</span>
    </button>
  );
}

const PHASES: Array<{ key: TrackedStatus['phase']; label: string }> = [
  { key: 'submitted', label: 'Submitted to the chain' },
  { key: 'processing', label: 'Consensus in progress' },
  { key: 'decided', label: 'Decided' },
  { key: 'finalized', label: 'Finalized' },
];

export function Timeline({ status }: { status: TrackedStatus }) {
  const order: TrackedStatus['phase'][] = ['submitted', 'pending', 'processing', 'decided', 'finalized'];
  const current = order.indexOf(status.phase);
  const outcome = describeOutcome(status.statusName, status.executionResultName);
  return (
    <div className="gltk-timeline" aria-live="polite">
      {PHASES.map((phase, index) => {
        const phasePos = order.indexOf(phase.key);
        const state = phasePos < current ? 'done' : phasePos === current ? 'active' : 'idle';
        const isOutcomeNode = phase.key === 'decided' && phasePos <= current;
        return (
          <div
            key={phase.key}
            className="gltk-node"
            data-state={state}
            data-tone={isOutcomeNode && outcome.tone !== 'success' ? outcome.tone : undefined}
          >
            <span className="gltk-node-rail">
              <span className="gltk-node-dot" />
              <span className="gltk-node-line" />
            </span>
            <span className="gltk-node-label">
              {isOutcomeNode ? `Decided — ${outcome.title}` : phase.label}
              {phase.key === 'submitted' && status.genlayerTxId ? (
                <span className="gltk-node-sub">
                  tx <code>{shortHash(status.genlayerTxId)}</code>
                </span>
              ) : null}
              {phase.key === 'decided' && isOutcomeNode && outcome.tone === 'success' && status.contractAddress ? (
                <span className="gltk-node-sub">
                  contract <code>{shortHash(status.contractAddress)}</code>
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function describeTarget(tx: SubmitInput): { kind: string; what: string } {
  if (tx.kind === 'deploy') return { kind: 'Deploy', what: 'New intelligent contract' };
  return { kind: 'Write', what: `${tx.method}() · ${shortHash(tx.address)}` };
}

export type TransactionPanelProps = {
  kit: TransactionKit;
  tx: SubmitInput;
  userValue?: bigint;
  network?: string;
  theme?: 'dark' | 'light';
  trackUntil?: 'decided' | 'finalized';
  snapState?: 'verified' | 'unavailable';
  onDone?: (status: TrackedStatus) => void;
};

export function GenLayerTransactionPanel(props: TransactionPanelProps) {
  const flow = useTransactionFlow({
    kit: props.kit,
    tx: props.tx,
    userValue: props.userValue,
    trackUntil: props.trackUntil,
  });
  const target = useMemo(() => describeTarget(props.tx), [props.tx]);
  const { state } = flow;
  const doneRef = useRef(false);
  if (state.step === 'done' && !doneRef.current) {
    doneRef.current = true;
    props.onDone?.(state.status);
  }

  const busy = state.step === 'estimating';
  const reviewing = state.step === 'review' || busy;

  return (
    <div className="gltk-root" data-theme={props.theme ?? 'dark'}>
      <div className="gltk-panel">
        <div className="gltk-head">
          <span className="gltk-head-title">GenLayer transaction</span>
          {props.network ? <span className="gltk-head-network">{props.network}</span> : null}
        </div>

        <div className="gltk-target">
          <span className="gltk-target-kind">{target.kind}</span>
          <span className="gltk-target-what">{target.what}</span>
        </div>

        {reviewing ? (
          <>
            <PresetSelector value={flow.preset} onChange={flow.setPreset} disabled={busy} />
            {flow.quote ? (
              <>
                <FeeReceipt quote={flow.quote} busy={busy} />
                <CapsShield quote={flow.quote} />
                <VerifyBadge
                  feeConfigHash={flow.verification?.feeConfigHash}
                  snapState={props.snapState}
                />
              </>
            ) : null}
            <div className="gltk-actions">
              <HoldToSign onConfirm={() => void flow.approve()} disabled={busy || !flow.quote} />
            </div>
          </>
        ) : null}

        {state.step === 'signing' ? (
          <>
            {state.quote ? <FeeReceipt quote={state.quote} /> : null}
            <div className="gltk-outcome" data-tone="warn">
              <p className="gltk-outcome-title">Waiting for your wallet</p>
              <p className="gltk-outcome-detail">Confirm the transaction in your wallet to continue.</p>
            </div>
            <div className="gltk-actions" />
          </>
        ) : null}

        {state.step === 'tracking' || state.step === 'done' ? (
          <>
            <Timeline status={state.status} />
            {state.step === 'done' ? <Outcome status={state.status} /> : null}
            <div className="gltk-actions">
              {state.step === 'done' ? (
                <div className="gltk-link-row">
                  <button type="button" onClick={flow.reset}>
                    New transaction
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {state.step === 'error' ? <ErrorSurface message={state.message} onRetry={flow.reset} /> : null}
      </div>
    </div>
  );
}

function Outcome({ status }: { status: TrackedStatus }) {
  const outcome = describeOutcome(status.statusName, status.executionResultName);
  return (
    <div className="gltk-outcome" data-tone={outcome.tone}>
      <p className="gltk-outcome-title">{outcome.title}</p>
      <p className="gltk-outcome-detail">{outcome.detail}</p>
    </div>
  );
}

function ErrorSurface({ message, onRetry }: { message: string; onRetry: () => void }) {
  const error = describeError(message);
  return (
    <>
      <div className="gltk-outcome" data-tone="error">
        <p className="gltk-outcome-title">{error.title}</p>
        <p className="gltk-outcome-detail">{error.detail}</p>
        <pre className="gltk-outcome-raw">{error.raw}</pre>
      </div>
      <div className="gltk-actions">
        <div className="gltk-link-row">
          <button type="button" onClick={onRetry}>
            Re-estimate and retry
          </button>
        </div>
      </div>
    </>
  );
}
