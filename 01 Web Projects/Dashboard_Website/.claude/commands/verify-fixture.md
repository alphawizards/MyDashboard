# /verify-fixture

Run the authoritative Fixture A calculation baseline and display the output.

This is the TDD ground truth required by `DEFINITION_OF_DONE.md` Gate 1.1.
Paste the output into any PR that touches calculation logic.

## What it does

```bash
node tools/verify_fixture_a.js
```

## Expected output (clean run)

```
savingsRate : 42.65
monthlyIO   : 5,133
monthlyPI   : 6,821
```

If the output differs from the expected values above, the calculation port is wrong — do **not** edit the expected values in the doc to make it pass. Flag for review first (see `CLAUDE.md` §Calculation Baseline).

## Steps

1. Run `node tools/verify_fixture_a.js` from the repo root.
2. Compare output against the three expected values above.
3. If all three match, output `✓ Fixture A baseline PASSED` and the raw output.
4. If any value differs, output a diff and the text `✗ Fixture A baseline FAILED — do not adjust expected values; investigate the port`.
