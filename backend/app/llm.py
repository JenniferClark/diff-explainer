"""Talking to OpenAI: client, model settings, and cost. Knows nothing about diffs."""
from dotenv import load_dotenv
from openai import AsyncOpenAI
from openai.types.responses import ResponseUsage

load_dotenv()  # must run before the client is created: it reads OPENAI_API_KEY

# Async client. A sync client inside `async def` would block the whole event loop.
client = AsyncOpenAI()

MODEL = "gpt-5-nano"
EFFORT = "minimal"

# USD per 1M tokens. Lives only in the backend, so prices are updated in one place.
PRICES_PER_1M = {
    "gpt-5-nano": {"input": 0.05, "cached_input": 0.005, "output": 0.40},
}


def estimate_cost(model: str, usage: ResponseUsage) -> float:
    prices = PRICES_PER_1M[model]
    cached = usage.input_tokens_details.cached_tokens
    uncached = usage.input_tokens - cached
    return (
        uncached * prices["input"]
        + cached * prices["cached_input"]
        + usage.output_tokens * prices["output"]
    ) / 1_000_000