import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from scripts.run_sweep import _generate_grid_variants

BASELINE = {
    "min_price": 5.0,
    "min_dol_vol": 10.0,
    "min_adr": 3.0,
    "max_pullback": 25.0,
    "bbw_percentile": 50.0,
    "min_prior_move": 30.0,
    "mom_threshold_1m": 20.0,   # non-grid param — must be preserved
}

GRID_A = {
    "max_pullback":   [15.0, 25.0, 35.0],
    "bbw_percentile": [35.0, 50.0, 65.0],
    "min_prior_move": [20.0, 30.0, 40.0],
}


def test_generate_grid_count():
    """3x3x3 grid produces exactly 27 variants."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    assert len(variants) == 27


def test_generate_grid_baseline_match_label():
    """Exactly one variant starts with BASELINE_MATCH and its params equal baseline."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    matches = [(label, p) for label, p in variants if label.startswith("BASELINE_MATCH")]
    assert len(matches) == 1
    label, params = matches[0]
    assert label.startswith("BASELINE_MATCH")
    assert params == BASELINE


def test_generate_grid_non_grid_params_preserved():
    """Parameters not in the grid are passed through unchanged from baseline."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    for label, p in variants:
        assert p["mom_threshold_1m"] == 20.0, f"Non-grid param mutated in: {label}"


def test_generate_grid_values_injected():
    """All three values for each grid parameter appear across variants."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    pullback_values = {p["max_pullback"] for _, p in variants}
    bbw_values = {p["bbw_percentile"] for _, p in variants}
    prior_values = {p["min_prior_move"] for _, p in variants}
    assert pullback_values == {15.0, 25.0, 35.0}
    assert bbw_values == {35.0, 50.0, 65.0}
    assert prior_values == {20.0, 30.0, 40.0}


def test_label_format():
    """Every label contains key=value pairs for each grid parameter."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    for label, p in variants:
        assert "max_pullback=" in label
        assert "bbw_percentile=" in label
        assert "min_prior_move=" in label


def test_empty_grid_returns_single_baseline():
    """Empty grid produces exactly one variant labeled BASELINE_MATCH with no trailing delimiter."""
    variants = _generate_grid_variants(BASELINE, {})
    assert len(variants) == 1
    label, params = variants[0]
    assert label == "BASELINE_MATCH"
    assert params == BASELINE


from scripts.run_sweep import _run_sweep_variant


def test_run_sweep_variant_signature():
    """_run_sweep_variant is importable and has expected signature."""
    import inspect
    sig = inspect.signature(_run_sweep_variant)
    params = list(sig.parameters.keys())
    assert "equity_df" in params
    assert "oos_start" in params
    assert "params" in params
    assert "initial_capital" in params
