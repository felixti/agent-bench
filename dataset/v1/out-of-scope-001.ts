import { cloneWorld, row } from "./_helpers.ts";

export default row({
  id: "out-of-scope-001",
  query: "Send Bob $50.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: [],
    tool_calls: [],
  },
});
