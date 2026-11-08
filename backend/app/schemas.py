"""Data shapes only: requests, responses, and what the LLM must return. No logic here."""
from typing import Literal

from pydantic import BaseModel, Field

MAX_DIFF_CHARS = 8000  # also checked in the frontend; this is the real guard

Label = Literal["feature", "bugfix", "docs", "refactor"]


class DiffIn(BaseModel):
    """Request body for both /explain/stream and /classify."""
    diff: str = Field(min_length=1, max_length=MAX_DIFF_CHARS)


class Usage(BaseModel):
    input_tokens: int
    output_tokens: int


class DiffClassification(BaseModel):
    """What the LLM must return."""
    label: Label
    reason: str = Field(description="One short sentence explaining the label.")


class ClassifyOut(BaseModel):
    """What /classify returns to the frontend."""
    label: Label
    reason: str
    needs_ticket: bool
    usage: Usage
    cost_usd: float