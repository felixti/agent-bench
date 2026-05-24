import type { Payment } from "../types.ts";

export const RISK_BLOCK_THRESHOLD = 0.7;

export type RiskAssessment = {
  payment_id: string;
  card_id: string;
  risk_score: number;
  signals: string[];
};

const elevatedRiskCountries = new Set(["BY", "RU", "IR", "KP"]);

export function scoreRisk(payment: Payment): RiskAssessment {
  const signals: string[] = [];
  let score = 0.1;

  if (payment.amount_cents >= 100000) {
    score += 0.35;
    signals.push("amount_outlier");
  }

  if (elevatedRiskCountries.has(payment.country)) {
    score += 0.45;
    signals.push("geo_anomaly");
  }

  if (payment.status !== "captured") {
    score += 0.1;
    signals.push("non_captured_status");
  }

  if (signals.length === 0) {
    signals.push("baseline");
  }

  return {
    payment_id: payment.id,
    card_id: payment.card_id,
    risk_score: Math.min(1, Number(score.toFixed(2))),
    signals,
  };
}
