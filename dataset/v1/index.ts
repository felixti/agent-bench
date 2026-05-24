import hallucinationTrap001 from "./hallucination-trap-001.ts";
import outOfScope001 from "./out-of-scope-001.ts";
import paymentsCharge001 from "./payments-charge-001.ts";
import paymentsNotFound001 from "./payments-not-found-001.ts";
import paymentsRefund001 from "./payments-refund-001.ts";
import riskBlockOnly001 from "./risk-block-only-001.ts";
import riskLowScore001 from "./risk-low-score-001.ts";
import riskRefund001 from "./risk-refund-001.ts";
import supportDeflect001 from "./support-deflect-001.ts";
import supportList001 from "./support-list-001.ts";
import supportStatus001 from "./support-status-001.ts";
import supportThenPayments001 from "./support-then-payments-001.ts";

export const DATASET_VERSION = "v1";

export const rows = [
  supportStatus001,
  supportList001,
  supportDeflect001,
  paymentsRefund001,
  paymentsCharge001,
  paymentsNotFound001,
  riskRefund001,
  riskBlockOnly001,
  riskLowScore001,
  supportThenPayments001,
  hallucinationTrap001,
  outOfScope001,
];
