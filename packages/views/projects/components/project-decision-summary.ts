import {
  DECISION_PHASES,
  DECISION_RISK_LEVELS,
  type DecisionPhase,
  type DecisionRiskLevel,
} from "@multica/core/types";
import {
  DECISION_PHASE_LABELS,
  DECISION_RISK_LEVEL_LABELS,
} from "../../issues/components/decision-case-meta";

const DECISION_PHASE_SET = new Set<string>(DECISION_PHASES);
const DECISION_RISK_LEVEL_SET = new Set<string>(DECISION_RISK_LEVELS);
const DECISION_RISK_SUMMARY_ORDER: DecisionRiskLevel[] = [
  "critical",
  "high",
  "medium",
  "low",
];

type DecisionSummaryLike = {
  phase?: string | null;
  risk_level?: string | null;
};

export interface DecisionSummaryStat<TValue extends string> {
  value: TValue;
  label: string;
  count: number;
}

export function isDecisionPhase(value: string | null | undefined): value is DecisionPhase {
  return Boolean(value && DECISION_PHASE_SET.has(value));
}

export function isDecisionRiskLevel(
  value: string | null | undefined,
): value is DecisionRiskLevel {
  return Boolean(value && DECISION_RISK_LEVEL_SET.has(value));
}

export function getProjectDecisionSummary<TDecision extends DecisionSummaryLike>(
  decisions: TDecision[],
) {
  const phaseCounts = new Map<DecisionPhase, number>();
  const riskCounts = new Map<DecisionRiskLevel, number>();

  for (const decision of decisions) {
    if (isDecisionPhase(decision.phase)) {
      phaseCounts.set(
        decision.phase,
        (phaseCounts.get(decision.phase) ?? 0) + 1,
      );
    }

    if (isDecisionRiskLevel(decision.risk_level)) {
      riskCounts.set(
        decision.risk_level,
        (riskCounts.get(decision.risk_level) ?? 0) + 1,
      );
    }
  }

  return {
    totalCount: decisions.length,
    phaseStats: DECISION_PHASES.flatMap((phase) =>
      phaseCounts.has(phase)
        ? [
            {
              value: phase,
              label: DECISION_PHASE_LABELS[phase],
              count: phaseCounts.get(phase) ?? 0,
            },
          ]
        : [],
    ),
    riskStats: DECISION_RISK_SUMMARY_ORDER.flatMap((riskLevel) =>
      riskCounts.has(riskLevel)
        ? [
            {
              value: riskLevel,
              label: DECISION_RISK_LEVEL_LABELS[riskLevel],
              count: riskCounts.get(riskLevel) ?? 0,
            },
          ]
        : [],
    ),
  };
}
