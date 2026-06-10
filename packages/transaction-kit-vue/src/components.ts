import {
  computed,
  defineComponent,
  h,
  ref,
  watch,
  type PropType,
  type VNodeChild,
} from 'vue';
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

function genValue(wei: bigint, busy?: boolean): VNodeChild {
  return h('span', { class: 'gltk-total-value', 'data-busy': busy ? 'true' : undefined }, [
    formatGen(wei),
    h('span', { class: 'gltk-unit' }, 'GEN'),
  ]);
}

function receiptRow(label: string, wei: bigint, hint?: string): VNodeChild {
  return h('div', { class: 'gltk-row' }, [
    h('span', { class: 'gltk-row-label' }, [
      label,
      hint ? h('span', { class: 'gltk-row-hint' }, hint) : null,
    ]),
    h('span', { class: 'gltk-row-value' }, [formatGen(wei), h('span', { class: 'gltk-unit' }, 'GEN')]),
  ]);
}

export const FeeReceipt = defineComponent({
  name: 'GltkFeeReceipt',
  props: {
    quote: { type: Object as PropType<PolicyQuote>, required: true },
    busy: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h('div', { class: 'gltk-receipt' }, [
        receiptRow('Consensus work', props.quote.breakdown.timeUnitFees, 'leader + validators, per round'),
        receiptRow('Execution budget', props.quote.breakdown.executionBudget, 'storage + receipt writes'),
        props.quote.breakdown.messageFees > 0n
          ? receiptRow('Message budget', props.quote.breakdown.messageFees, 'child transactions')
          : null,
        props.quote.userValue > 0n
          ? receiptRow('Value sent', props.quote.userValue, 'delivered to the contract')
          : null,
        h('div', { class: 'gltk-total' }, [
          h('span', { class: 'gltk-total-label' }, 'Total deposit'),
          genValue(props.quote.total, props.busy),
        ]),
        h(
          'p',
          { class: 'gltk-refundable' },
          'Unused amounts are refunded when the transaction finalizes.',
        ),
      ]);
  },
});

export const PresetSelector = defineComponent({
  name: 'GltkPresetSelector',
  props: {
    modelValue: { type: String as PropType<FeePreset>, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { class: 'gltk-presets', role: 'radiogroup', 'aria-label': 'Fee preset' },
        (Object.keys(PRESET_COPY) as FeePreset[]).map((preset) =>
          h(
            'button',
            {
              key: preset,
              type: 'button',
              role: 'radio',
              class: 'gltk-preset',
              'aria-checked': props.modelValue === preset,
              'data-active': props.modelValue === preset ? 'true' : undefined,
              disabled: props.disabled,
              onClick: () => emit('update:modelValue', preset),
            },
            [PRESET_COPY[preset].label, h('small', PRESET_COPY[preset].sub)],
          ),
        ),
      );
  },
});

export const CapsShield = defineComponent({
  name: 'GltkCapsShield',
  props: { quote: { type: Object as PropType<PolicyQuote>, required: true } },
  setup(props) {
    return () =>
      h('div', { class: 'gltk-caps' }, [
        h('div', { class: 'gltk-caps-title' }, 'Price protection'),
        h('div', { class: 'gltk-caps-grid' }, [
          h('span', { class: 'gltk-cap' }, [
            'Time-unit price cap ',
            h('b', `${formatGen(props.quote.caps.genPerTimeUnit)} GEN`),
          ]),
          h('span', { class: 'gltk-cap' }, [
            'Storage price cap ',
            h('b', `${props.quote.caps.storagePrice.toString()} wei`),
          ]),
          h('span', { class: 'gltk-cap' }, [
            'Receipt gas cap ',
            h('b', `${props.quote.caps.receiptPrice.toString()} wei`),
          ]),
        ]),
        h(
          'p',
          { class: 'gltk-caps-note' },
          'If network prices rise above any cap, the transaction is rejected and nothing is charged.',
        ),
      ]);
  },
});

export const HoldToSign = defineComponent({
  name: 'GltkHoldToSign',
  props: {
    disabled: { type: Boolean, default: false },
    holdMs: { type: Number, default: 900 },
    label: { type: String, default: 'Approve & sign' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const holding = ref(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (props.disabled) return;
      holding.value = true;
      timer = setTimeout(() => {
        holding.value = false;
        emit('confirm');
      }, props.holdMs);
    };
    const cancel = () => {
      holding.value = false;
      if (timer) clearTimeout(timer);
    };
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: 'gltk-hold',
          style: { '--gltk-hold-ms': `${props.holdMs}ms` },
          'data-holding': holding.value ? 'true' : undefined,
          disabled: props.disabled,
          onPointerdown: start,
          onPointerup: cancel,
          onPointerleave: cancel,
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              emit('confirm');
            }
          },
        },
        [
          h('span', { class: 'gltk-hold-fill', 'aria-hidden': 'true' }),
          props.label,
          h('span', { class: 'gltk-hold-hint' }, 'hold to confirm'),
        ],
      );
  },
});

const PHASES: Array<{ key: TrackedStatus['phase']; label: string }> = [
  { key: 'submitted', label: 'Submitted to the chain' },
  { key: 'processing', label: 'Consensus in progress' },
  { key: 'decided', label: 'Decided' },
  { key: 'finalized', label: 'Finalized' },
];

export const Timeline = defineComponent({
  name: 'GltkTimeline',
  props: { status: { type: Object as PropType<TrackedStatus>, required: true } },
  setup(props) {
    return () => {
      const order: TrackedStatus['phase'][] = [
        'submitted',
        'pending',
        'processing',
        'decided',
        'finalized',
      ];
      const current = order.indexOf(props.status.phase);
      const outcome = describeOutcome(props.status.statusName, props.status.executionResultName);
      return h(
        'div',
        { class: 'gltk-timeline', 'aria-live': 'polite' },
        PHASES.map((phase) => {
          const phasePos = order.indexOf(phase.key);
          const state = phasePos < current ? 'done' : phasePos === current ? 'active' : 'idle';
          const isOutcomeNode = phase.key === 'decided' && phasePos <= current;
          return h(
            'div',
            {
              key: phase.key,
              class: 'gltk-node',
              'data-state': state,
              'data-tone': isOutcomeNode && outcome.tone !== 'success' ? outcome.tone : undefined,
            },
            [
              h('span', { class: 'gltk-node-rail' }, [
                h('span', { class: 'gltk-node-dot' }),
                h('span', { class: 'gltk-node-line' }),
              ]),
              h('span', { class: 'gltk-node-label' }, [
                isOutcomeNode ? `Decided — ${outcome.title}` : phase.label,
                phase.key === 'submitted' && props.status.genlayerTxId
                  ? h('span', { class: 'gltk-node-sub' }, [
                      'tx ',
                      h('code', shortHash(props.status.genlayerTxId)),
                    ])
                  : null,
                phase.key === 'decided' && isOutcomeNode && outcome.tone === 'success' && props.status.contractAddress
                  ? h('span', { class: 'gltk-node-sub' }, [
                      'contract ',
                      h('code', shortHash(props.status.contractAddress)),
                    ])
                  : null,
              ]),
            ],
          );
        }),
      );
    };
  },
});

function outcomeSurface(status: TrackedStatus): VNodeChild {
  const outcome = describeOutcome(status.statusName, status.executionResultName);
  return h('div', { class: 'gltk-outcome', 'data-tone': outcome.tone }, [
    h('p', { class: 'gltk-outcome-title' }, outcome.title),
    h('p', { class: 'gltk-outcome-detail' }, outcome.detail),
  ]);
}

export const GenLayerTransactionPanel = defineComponent({
  name: 'GenLayerTransactionPanel',
  props: {
    kit: { type: Object as PropType<TransactionKit>, required: true },
    tx: { type: Object as PropType<SubmitInput>, required: true },
    userValue: { type: BigInt as unknown as PropType<bigint>, default: undefined },
    network: { type: String, default: undefined },
    theme: { type: String as PropType<'dark' | 'light'>, default: 'dark' },
    trackUntil: { type: String as PropType<'decided' | 'finalized'>, default: 'decided' },
    snapState: { type: String as PropType<'verified' | 'unavailable'>, default: undefined },
  },
  emits: ['done'],
  setup(props, { emit }) {
    const flow = useTransactionFlow({
      kit: props.kit,
      tx: props.tx,
      userValue: props.userValue,
      trackUntil: props.trackUntil,
    });
    let doneEmitted = false;
    watch(flow.state, (state) => {
      if (state.step === 'done' && !doneEmitted) {
        doneEmitted = true;
        emit('done', state.status);
      }
    });

    const target = computed(() =>
      props.tx.kind === 'deploy'
        ? { kind: 'Deploy', what: 'New intelligent contract' }
        : { kind: 'Write', what: `${props.tx.method}() · ${shortHash(props.tx.address)}` },
    );

    return () => {
      const state = flow.state.value;
      const busy = state.step === 'estimating';
      const reviewing = state.step === 'review' || busy;
      const children: VNodeChild[] = [
        h('div', { class: 'gltk-head' }, [
          h('span', { class: 'gltk-head-title' }, 'GenLayer transaction'),
          props.network ? h('span', { class: 'gltk-head-network' }, props.network) : null,
        ]),
        h('div', { class: 'gltk-target' }, [
          h('span', { class: 'gltk-target-kind' }, target.value.kind),
          h('span', { class: 'gltk-target-what' }, target.value.what),
        ]),
      ];

      if (reviewing) {
        children.push(
          h(PresetSelector, {
            modelValue: flow.preset.value,
            disabled: busy,
            'onUpdate:modelValue': (preset: FeePreset) => {
              flow.preset.value = preset;
            },
          }),
        );
        const quote = flow.quote.value;
        if (quote) {
          children.push(h(FeeReceipt, { quote, busy }));
          children.push(h(CapsShield, { quote }));
          const verification = flow.verification.value;
          if (verification) {
            children.push(
              h(
                'div',
                {
                  class: 'gltk-verify',
                  'data-state': props.snapState === 'verified' ? 'verified' : undefined,
                },
                [
                  h(
                    'span',
                    props.snapState === 'verified'
                      ? '✓ Verified by GenLayer Snap'
                      : 'Policy fingerprint',
                  ),
                  h('code', shortHash(verification.feeConfigHash, 10, 6)),
                ],
              ),
            );
          }
        }
        children.push(
          h('div', { class: 'gltk-actions' }, [
            h(HoldToSign, {
              disabled: busy || !flow.quote.value,
              onConfirm: () => void flow.approve(),
            }),
          ]),
        );
      }

      if (state.step === 'signing') {
        children.push(
          h(FeeReceipt, { quote: state.quote }),
          h('div', { class: 'gltk-outcome', 'data-tone': 'warn' }, [
            h('p', { class: 'gltk-outcome-title' }, 'Waiting for your wallet'),
            h('p', { class: 'gltk-outcome-detail' }, 'Confirm the transaction in your wallet to continue.'),
          ]),
          h('div', { class: 'gltk-actions' }),
        );
      }

      if (state.step === 'tracking' || state.step === 'done') {
        children.push(h(Timeline, { status: state.status }));
        if (state.step === 'done') {
          children.push(outcomeSurface(state.status));
          children.push(
            h('div', { class: 'gltk-actions' }, [
              h('div', { class: 'gltk-link-row' }, [
                h('button', { type: 'button', onClick: () => flow.reset() }, 'New transaction'),
              ]),
            ]),
          );
        }
      }

      if (state.step === 'error') {
        const error = describeError(state.message);
        children.push(
          h('div', { class: 'gltk-outcome', 'data-tone': 'error' }, [
            h('p', { class: 'gltk-outcome-title' }, error.title),
            h('p', { class: 'gltk-outcome-detail' }, error.detail),
            h('pre', { class: 'gltk-outcome-raw' }, error.raw),
          ]),
          h('div', { class: 'gltk-actions' }, [
            h('div', { class: 'gltk-link-row' }, [
              h('button', { type: 'button', onClick: () => flow.reset() }, 'Re-estimate and retry'),
            ]),
          ]),
        );
      }

      return h('div', { class: 'gltk-root', 'data-theme': props.theme }, [
        h('div', { class: 'gltk-panel' }, children),
      ]);
    };
  },
});
