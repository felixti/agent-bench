import type { Payment, ToolResult, WorldState, WorldStateMutation } from "../types.ts";

export class WorldStore {
  private world: WorldState;
  private log: WorldStateMutation[] = [];

  constructor(
    seed: WorldState,
    private readonly now: string,
  ) {
    this.world = structuredClone(seed);
  }

  snapshot(): WorldState {
    return structuredClone(this.world);
  }

  mutations(): WorldStateMutation[] {
    return structuredClone(this.log);
  }

  getPayment(paymentId: string): Payment | undefined {
    return this.world.payments.find((payment) => payment.id === paymentId);
  }

  getPaymentStatus(paymentId: string): ToolResult<Payment> {
    const payment = this.getPayment(paymentId);
    if (!payment) {
      return { ok: false, error: { code: "not_found", message: `payment ${paymentId} not found` } };
    }

    return { ok: true, data: structuredClone(payment) };
  }

  listPayments(customerId: string): ToolResult<{ payments: Payment[] }> {
    const customer = this.world.customers.find((item) => item.id === customerId);
    if (!customer) {
      return {
        ok: false,
        error: { code: "not_found", message: `customer ${customerId} not found` },
      };
    }

    return {
      ok: true,
      data: {
        payments: structuredClone(this.world.payments.filter((p) => p.customer_id === customerId)),
      },
    };
  }

  charge(input: {
    customer_id: string;
    card_id: string;
    amount_cents: number;
    country: string;
  }): ToolResult<Payment> {
    const card = this.world.cards.find((item) => item.id === input.card_id);
    if (!card) {
      return {
        ok: false,
        error: { code: "not_found", message: `card ${input.card_id} not found` },
      };
    }

    if (card.blocked) {
      return {
        ok: false,
        error: { code: "card_blocked", message: `card ${input.card_id} is blocked` },
      };
    }

    const payment: Payment = {
      id: `pay_${input.customer_id}_${input.card_id}_${this.world.payments.length + 1}`,
      customer_id: input.customer_id,
      card_id: input.card_id,
      amount_cents: input.amount_cents,
      currency: "USD",
      country: input.country,
      status: "captured",
      created_at: this.now,
    };

    this.world.payments.push(payment);
    this.log.push({
      tool: "charge",
      entity: "payment",
      entity_id: payment.id,
      before: null,
      after: structuredClone(payment),
    });

    return { ok: true, data: structuredClone(payment) };
  }

  refund(paymentId: string, amountCents: number | undefined, reason: string): ToolResult<Payment> {
    const payment = this.getPayment(paymentId);
    if (!payment) {
      return { ok: false, error: { code: "not_found", message: `payment ${paymentId} not found` } };
    }

    if (payment.status === "refunded") {
      return {
        ok: false,
        error: { code: "already_refunded", message: `payment ${paymentId} is already refunded` },
      };
    }

    const refundAmountCents = amountCents ?? payment.amount_cents;

    if (refundAmountCents !== payment.amount_cents) {
      return {
        ok: false,
        error: {
          code: "amount_mismatch",
          message: `refund amount ${refundAmountCents} does not match payment amount ${payment.amount_cents}`,
        },
      };
    }

    const before = structuredClone(payment);
    payment.status = "refunded";
    const after = structuredClone(payment);

    this.log.push({
      tool: "refund",
      entity: "payment",
      entity_id: paymentId,
      before,
      after: { ...after, reason },
    });

    return { ok: true, data: after };
  }

  blockCard(cardId: string, reason: string): ToolResult<{ card_id: string; blocked: boolean }> {
    const card = this.world.cards.find((item) => item.id === cardId);
    if (!card) {
      return { ok: false, error: { code: "not_found", message: `card ${cardId} not found` } };
    }

    const before = structuredClone(card);
    card.blocked = true;
    const after = structuredClone(card);

    this.log.push({
      tool: "block_card",
      entity: "card",
      entity_id: cardId,
      before,
      after: { ...after, reason },
    });

    return { ok: true, data: { card_id: cardId, blocked: true } };
  }
}
