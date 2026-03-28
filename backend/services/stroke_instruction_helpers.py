"""Pure helpers: validate/format stroke polylines and parse bullet lists from model text."""

from __future__ import annotations

import re


def validate_stroke_points(strokes: list[list[float]]) -> None:
    if not strokes:
        raise ValueError("stroke_points must contain at least one stroke.")
    for i, stroke in enumerate(strokes):
        if len(stroke) < 4:
            raise ValueError(f"Stroke {i} must have at least two (x, y) pairs (4 numbers).")
        if len(stroke) % 2 != 0:
            raise ValueError(f"Stroke {i} must have an even number of values (pairs of x, y).")


def format_stroke_points_for_prompt(strokes: list[list[float]]) -> str:
    """Format flat x,y sequences as ordered (x, y) chains per stroke for the LLM prompt."""
    validate_stroke_points(strokes)
    lines: list[str] = []
    for i, stroke in enumerate(strokes):
        pts: list[str] = []
        for j in range(0, len(stroke), 2):
            pts.append(f"({stroke[j]:.4g}, {stroke[j + 1]:.4g})")
        lines.append(f"Stroke {i + 1} (in order): " + " → ".join(pts))
    return "\n".join(lines)


def _strip_bullet_prefix(line: str) -> str | None:
    s = line.strip()
    if s.startswith(("- ", "* ", "• ")):
        return s[2:].strip()
    m = re.match(r"^\d+\.\s+(.+)$", s)
    if m:
        return m.group(1).strip()
    m = re.match(r"^\d+\)\s+(.+)$", s)
    if m:
        return m.group(1).strip()
    return None


def bullet_lines_from_model_text(text: str) -> list[str]:
    """Extract bullet lines; if none match, return non-empty lines as fallback."""
    if not text or not text.strip():
        return []

    bullets: list[str] = []
    for line in text.splitlines():
        body = _strip_bullet_prefix(line)
        if body:
            bullets.append(body)

    if bullets:
        return bullets

    return [ln.strip() for ln in text.splitlines() if ln.strip()]
