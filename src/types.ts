export type WorkerName = "payments" | "risk" | "support";

export type PaymentStatus = "authorized" | "captured" | "refunded" | "failed";

export type Customer = {
  id: string;
  name: string;
};

export type Card = {
  id: string;
  customer_id: string;
  last4: string;
  blocked: boolean;
};

export type Payment = {
  id: string;
  customer_id: string;
  card_id: string;
  amount_cents: number;
  currency: "USD";
  country: string;
  status: PaymentStatus;
  created_at: string;
};

export type WorldState = {
  customers: Customer[];
  cards: Card[];
  payments: Payment[];
};

export type PartialWorldState = {
  customers?: Array<Partial<Customer> & Pick<Customer, "id">>;
  cards?: Array<Partial<Card> & Pick<Card, "id">>;
  payments?: Array<Partial<Payment> & Pick<Payment, "id">>;
};

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type ArgMatcher =
  | { kind: "eq"; value: unknown }
  | { kind: "approx"; value: number; tolerance: number }
  | { kind: "regex"; pattern: string }
  | { kind: "any" };

export type ExpectedToolCall = {
  worker: WorkerName;
  tool: string;
  args: Record<string, ArgMatcher>;
};

export type BenchmarkRow = {
  id: string;
  query: string;
  world_state_seed: WorldState;
  expected: {
    workers: WorkerName[];
    ignore_routing?: boolean;
    tool_calls: ExpectedToolCall[];
    final_world_state?: PartialWorldState;
  };
};

export type WorldStateMutation = {
  tool: string;
  entity: "payment" | "card";
  entity_id: string;
  before: unknown;
  after: unknown;
};

export type ObservedToolCall = {
  worker: WorkerName;
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type CompletionFailure =
  | "error_thrown"
  | "supervisor_budget_exceeded"
  | "worker_budget_exceeded"
  | "truncated";

export type AxisScore = {
  passed: boolean;
  details: string;
};

export type CompletionScore = AxisScore & {
  failure?: CompletionFailure;
};

export type RowScore = {
  routing: AxisScore;
  tool_selection: AxisScore;
  tool_args: AxisScore;
  world_state: AxisScore;
  completion: CompletionScore;
  overall: boolean;
};

export type RowTrace = {
  row_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  model_id: string;
  prompts_version: string;
  dataset_version: string;
  commit: string | null;
  query: string;
  world_state_seed: WorldState;
  route: WorkerName[];
  tool_calls: ObservedToolCall[];
  world_state_log: WorldStateMutation[];
  final_world_state: WorldState;
  messages: unknown[];
  expected: BenchmarkRow["expected"];
  score: RowScore;
  warnings: string[];
  step_counts: {
    supervisor: number;
    per_worker: Record<WorkerName, number>;
  };
};
