import type { ArgMatcher, AxisScore, PartialWorldState, WorldState } from "../types.ts";

export function argsMatch(
  actual: Record<string, unknown>,
  expected: Record<string, ArgMatcher>,
): AxisScore {
  for (const [key, matcher] of Object.entries(expected)) {
    const value = actual[key];
    const result = valueMatches(value, matcher);

    if (!result.passed) {
      return {
        passed: false,
        details: `${key}: ${result.details}`,
      };
    }
  }

  return { passed: true, details: "all arguments matched" };
}

export function valueMatches(actual: unknown, matcher: ArgMatcher): AxisScore {
  switch (matcher.kind) {
    case "any":
      return { passed: true, details: "any value accepted" };
    case "eq":
      if (deepEqual(actual, matcher.value)) {
        return { passed: true, details: "equal" };
      }
      return {
        passed: false,
        details: `expected eq ${JSON.stringify(matcher.value)}, got ${JSON.stringify(actual)}`,
      };
    case "approx":
      if (typeof actual !== "number") {
        return {
          passed: false,
          details: `expected number approx ${matcher.value}, got ${JSON.stringify(actual)}`,
        };
      }
      if (Math.abs(actual - matcher.value) <= matcher.tolerance) {
        return { passed: true, details: "approximately equal" };
      }
      return {
        passed: false,
        details: `expected approx ${matcher.value} +/- ${matcher.tolerance}, got ${actual}`,
      };
    case "regex":
      if (new RegExp(matcher.pattern).test(String(actual))) {
        return { passed: true, details: "regex matched" };
      }
      return {
        passed: false,
        details: `expected regex /${matcher.pattern}/, got ${JSON.stringify(actual)}`,
      };
  }
}

export function partialWorldMatches(actual: WorldState, expected?: PartialWorldState): AxisScore {
  if (!expected) {
    return { passed: true, details: "no world state assertion" };
  }

  const checks = [
    checkEntities("customers", actual.customers, expected.customers),
    checkEntities("cards", actual.cards, expected.cards),
    checkEntities("payments", actual.payments, expected.payments),
  ];

  const failure = checks.find((check) => !check.passed);
  if (failure) {
    return failure;
  }

  return { passed: true, details: "world state matched" };
}

function checkEntities<T extends { id: string }>(
  label: string,
  actual: T[],
  expected: Array<Partial<T> & Pick<T, "id">> | undefined,
): AxisScore {
  if (!expected) {
    return { passed: true, details: `${label}: no assertion` };
  }

  for (const expectedEntity of expected) {
    const actualEntity = actual.find((entity) => entity.id === expectedEntity.id);
    if (!actualEntity) {
      return { passed: false, details: `${label}: missing entity ${expectedEntity.id}` };
    }

    for (const [key, expectedValue] of Object.entries(expectedEntity)) {
      const actualValue = actualEntity[key as keyof T];
      if (!deepEqual(actualValue, expectedValue)) {
        return {
          passed: false,
          details: `${label}.${expectedEntity.id}.${key}: expected ${JSON.stringify(
            expectedValue,
          )}, got ${JSON.stringify(actualValue)}`,
        };
      }
    }
  }

  return { passed: true, details: `${label}: matched` };
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
