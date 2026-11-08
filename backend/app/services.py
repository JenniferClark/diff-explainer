"""Business logic: how we explain and classify a diff. Knows nothing about HTTP."""
import asyncio
import json

from openai import APIError
from openai.types.responses import ResponseUsage
from pydantic import BaseModel, ValidationError

from app.llm import EFFORT, MODEL, client, estimate_cost
from app.schemas import ClassifyOut, DiffClassification, Usage

# ---------- explain (streaming) ----------

EXPLAIN_INSTRUCTIONS = (
    "You explain git diff to a teammate\n"
    "Explain what the diff changes and why it might matter, in 3-5 short sentences."
)


def sse(payload: dict) -> str:
    """Turn a dict into one SSE message. JSON escapes newlines, so they can't break the message."""
    return f"data: {json.dumps(payload)}\n\n"


async def explain_stream(diff: str):
    """Async generator: receive events from OpenAI and yield SSE messages as they arrive."""
    try:
        stream = await client.responses.create(
            model=MODEL,
            instructions=EXPLAIN_INSTRUCTIONS,
            input=diff,
            reasoning={"effort": EFFORT},
            max_output_tokens=800,
            stream=True,
        )
        # async with: the OpenAI connection is closed on success, error, or client disconnect
        async with stream:
            async for event in stream:
                if event.type == "response.output_text.delta":
                    yield sse({"type": "delta", "text": event.delta})
                elif event.type == "response.completed":
                    usage = event.response.usage
                    yield sse({
                        "type": "done",
                        "usage": {"input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens},
                        "cost_usd": estimate_cost(MODEL, usage),
                    })
                elif event.type in ("response.incomplete", "response.failed"):
                    yield sse({"type": "error", "message": f"LLM stream ended: {event.type}"})
    except APIError as e:
        # The stream has started, so 200 is already sent. Errors can only go into the stream.
        yield sse({"type": "error", "message": f"{type(e).__name__}: {e}"})
    except asyncio.CancelledError:
        print("⚠️  client disconnected — closing the upstream LLM stream")
        raise


# ---------- classify (one response) ----------

CLASSIFY_INSTRUCTIONS = (
    "Classify the git diff.\n"
    "- bugfix: fixes incorrect behavior that users or tests could observe\n"
    "- feature: adds new functionality or new behavior\n"
    "- docs: changes documentation only, no code changes\n"
    "- refactor: restructures code without changing observable behavior\n"
    "If more than one label fits, prefer bugfix > feature > refactor > docs."
)


class ClassifyError(Exception):
    """Classification failed. The route turns this into a 502."""


class IncompleteResponseError(Exception):
    pass


class ClassifyResult(BaseModel):
    ok: bool
    data: DiffClassification | None = None
    error: str | None = None
    usage: ResponseUsage | None = None


async def call_once(diff: str) -> tuple[DiffClassification, ResponseUsage]:
    res = await client.responses.parse(
        model=MODEL,
        instructions=CLASSIFY_INSTRUCTIONS,
        input=diff,
        reasoning={"effort": EFFORT},
        max_output_tokens=300,
        text_format=DiffClassification,
    )
    if res.status != "completed":
        raise IncompleteResponseError(f"response status={res.status} ({res.incomplete_details})")
    if res.output_parsed is None:
        raise RuntimeError("no parsed output (the model may have refused)")
    return res.output_parsed, res.usage


async def classify_diff(diff: str, max_attempts: int = 2) -> ClassifyResult:
    last_error = ""
    for attempt in range(1, max_attempts + 1):
        try:
            output_parsed, usage = await call_once(diff)
            return ClassifyResult(ok=True, data=output_parsed, usage=usage)
        except ValidationError as e:
            last_error = f"ValidationError: {e}"
            print(f"     attempt {attempt} failed, retrying -> {last_error}")
        except (APIError, IncompleteResponseError, RuntimeError) as e:
            return ClassifyResult(ok=False, error=f"{type(e).__name__}: {e}")
    return ClassifyResult(ok=False, error=last_error)


async def classify(diff: str) -> ClassifyOut:
    """The whole classify use case: call the LLM, then apply our own rules."""
    result = await classify_diff(diff)
    if not result.ok:
        raise ClassifyError(result.error)
    data = result.data
    return ClassifyOut(
        label=data.label,
        reason=data.reason,
        needs_ticket=data.label in ("bugfix", "feature"),  # our rule, computed in code, not by the LLM
        usage=Usage(input_tokens=result.usage.input_tokens, output_tokens=result.usage.output_tokens),
        cost_usd=estimate_cost(MODEL, result.usage),
    )