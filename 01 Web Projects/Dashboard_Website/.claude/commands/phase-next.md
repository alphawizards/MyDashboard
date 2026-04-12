# /phase-next

Jump to the next unstarted phase in the Blueprint A planning pipeline.

## What it does

1. Reads `plans/retireau-a-planning-pipeline.md` to identify the current phase status.
2. Finds the first phase not marked `[DONE]` or `[IN PROGRESS]`.
3. Prints the phase name, goal, inputs, outputs, and the first action to take.
4. Asks: "Start this phase now? (yes / skip to preview next phase)"

## Steps

1. Read `plans/retireau-a-planning-pipeline.md`.
2. Identify phases by their `## Phase N` heading. Look for `[DONE]`, `[IN PROGRESS]`, or no status tag.
3. Output the next actionable phase summary.
4. Offer to invoke `gsd:execute-phase` or the relevant Blueprint A step.
