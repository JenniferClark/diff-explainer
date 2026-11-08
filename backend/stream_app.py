"""
Week2 · Wed 10/21 —— Streaming 后端
放到 ai-learning/week02/stream_app.py
运行：uv run fastapi dev week02/stream_app.py

测试（另开一个终端）：
curl -N -X POST http://127.0.0.1:8000/explain/stream \
  -H "Content-Type: application/json" \
  -d '{"diff": "- if user.assignee:\n+ if user.assignee is not None:\n      sync(user.assignee)"}'

-N 的意思是「不要缓冲，收到就打印」。去掉 -N，你会看到 curl 等全部收完才一次性打印。
"""

import asyncio
import json

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI, APIError
from openai.types.responses import ResponseUsage
from pydantic import BaseModel, Field, ValidationError
from typing import Literal

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# 注意：这里用 AsyncOpenAI，不是 OpenAI。
# 在 async def 里用同步 client 会卡住整个事件循环（10/15 /slow 卡住 /health 那一课）
client = AsyncOpenAI()

MODEL = "gpt-5-nano"
EFFORT = "minimal"

INSTRUCTIONS = (
    "You explain git diff to a teammate\n"
    "Explain what the diff changes and why it might matter, in 3-5 short sentences."
)

class ExplainIn(BaseModel):
    diff: str = Field(min_length=1, max_length=8000)

def sse(payload: dict) -> str:
    """把一个 dict 变成一条 SSE 消息。

        为什么用 JSON，而不是直接写 f"data: {text}\\n\\n"？
        1. 模型输出的文字里可能有换行，而 SSE 用空行表示「一条消息结束」，换行会把消息切坏。
           json.dumps 会把换行转义成 \\n，问题就没了。
        2. 加一个 type 字段，就能在同一条流里区分「文字片段」「结束」「出错」三种消息。
        """
    return f"data: {json.dumps(payload)}\n\n"


async def explain_stream(diff: str):
    """ async generator：一边从 OpenAI 收事件，一边 yield SSE 消息。 """
    try:
        stream = await client.responses.create(
            model=MODEL,
            instructions=INSTRUCTIONS,
            input=diff,
            reasoning={"effort": EFFORT},
            max_output_tokens=800,
            stream=True,  # 关键：返回的是事件流，不是完整的 response
        )
        # async with：不管是正常结束、出错，还是客户端断开，离开这个块时都会关闭和 OpenAI 的连接
        async with stream:
            async for event in stream:
                if event.type == "response.output_text.delta":
                    yield sse({"type": "delta", "text": event.delta})
                elif event.type == "response.completed":
                # 最后一个事件，里面带着完整的 response，可以拿到 usage
                    usage = event.response.usage
                    yield sse({
                        "type": "done",
                        "usage": {
                            "input_tokens": usage.input_tokens,
                            "output_tokens": usage.output_tokens,
                        },
                        "cost_usd": estimate_cost(MODEL, usage)
                    })
                elif event.type in("response.incomplete", "response.failed"):
                    # 昨晚的老问题：预算不够等情况，在 streaming 里是一个事件
                    yield sse({
                        "type": "error",
                        "message": f"LLM stream ended: {event.type}"
                    })

    except APIError as e:
        # 重点：流已经开始后，HTTP 状态码 200 早就发出去了，不能再返回 502。
        # 所以错误只能作为流里的一条消息发给客户端。
        yield sse({
            "type": "error",
            "message": f"{type(e).__name__}: {e}"
        })
    except asyncio.CancelledError:
        # 客户端中途断开（关页面 / curl 按 Ctrl+C）时，FastAPI 会取消这个 generator，
        # 异常会在当前的 await 处出现。上面的 async with 会负责关闭和 OpenAI 的连接。
        print("⚠️  client disconnected — closing the upstream LLM stream")
        raise

PRICES_PER_1M = {
    "gpt-5-nano": {
        "input": 0.05,
        "cached_input": 0.005,
        "output": 0.40
    }
}

def estimate_cost(model: str, usage) -> float:
    prices = PRICES_PER_1M[model]
    cached = usage.input_tokens_details.cached_tokens
    uncached = usage.input_tokens - cached
    return (
            uncached * prices["input"]
            + cached * prices["cached_input"]
            + usage.output_tokens * prices["output"]
    ) / 1_000_000


@app.post("/explain/stream")
async def explain(body: ExplainIn):
    # 这里不 await 任何东西，只是把 generator 交给 StreamingResponse。
    # StreamingResponse 会一边从 generator 取数据，一边写进 HTTP 响应。
    return StreamingResponse(explain_stream(body.diff), media_type="text/event-stream")

CLASSIFY_INSTRUCTIONS = (
    "Classify the git diff.\n"
    "- bugfix: fixes incorrect behavior that users or tests could observe\n"
    "- feature: adds new functionality or new behavior\n"
    "- docs: changes documentation only, no code changes\n"
    "- refactor: restructures code without changing observable behavior\n"
    "If more than one label fits, prefer bugfix > feature > refactor > docs."
)

class Usage(BaseModel):
    input_tokens: int
    output_tokens: int

class DiffIn(BaseModel):
    diff: str = Field(min_length=1, max_length=8000)

# what the LLM must return
class DiffClassification(BaseModel):
    label: Literal["feature", "bugfix", "docs", "refactor"]
    reason: str = Field(description="One short sentence explaining the label.")

# what our api returns
class ClassifyOut(BaseModel):
    label: Literal["feature", "bugfix", "docs", "refactor"]
    reason: str
    needs_ticket: bool
    usage: Usage
    cost_usd: float

class ClassifyResult(BaseModel):
    ok: bool
    data: DiffClassification | None = None
    error: str | None = None
    usage: ResponseUsage | None = None

class IncompleteResponseError(Exception):
    pass

async def call_once(diff: str) -> tuple[DiffClassification, ResponseUsage]:
    res = await client.responses.parse(
        model=MODEL,
        instructions=CLASSIFY_INSTRUCTIONS,
        input=diff,
        reasoning={"effort": EFFORT},
        max_output_tokens=300,
        text_format=DiffClassification
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
            return ClassifyResult(ok=True, data=output_parsed, error=None, usage=usage)
        except ValidationError as e:
            last_error = f"ValidationError: {e}"
            print(f"     attempt {attempt} failed, retrying -> {last_error}")
        except (APIError, IncompleteResponseError, RuntimeError) as e:
            return ClassifyResult(ok=False, data=None, error=f"{type(e).__name__}: {e}", usage=None)

    return ClassifyResult(ok=False, data=None, error=last_error, usage=None)

@app.post("/classify", response_model=ClassifyOut)
async def classify_endpoint(body: DiffIn) -> ClassifyOut:
    result = await classify_diff(body.diff)
    if result.ok:
        data = result.data
        needs_ticket = data.label in ("bugfix", "feature")
        cost_usd = estimate_cost(MODEL, result.usage)
        usage = Usage(
            input_tokens=result.usage.input_tokens,
            output_tokens=result.usage.output_tokens,
        )
        return ClassifyOut(label=data.label, reason=data.reason, needs_ticket=needs_ticket, cost_usd=cost_usd, usage=usage)

    raise HTTPException(status_code=502, detail=result.error)


@app.get("/fake/stream")
async def fake_stream():
    async def gen():
        for w in ["Hello", " from", " a", " fake", " stream"]:
            await asyncio.sleep(1)
            yield sse({"type": "delta", "text": w})

    return StreamingResponse(gen(), media_type="text/event-stream")

@app.post("/fake/split")
async def fake_split():
    data = (
        'data: {"type": "delta", "text": "Hello"}\n\n'
        'data: {"type": "delta", "text": " 世界"}\n\n'
        'data: {"type": "done", "input_tokens": 1, "output_tokens": 2}\n\n'
    ).encode()

    # 第 1 条消息的中间
    cut1 = data.index(b'"te') + 3
    # 「世」这个字的 3 个字节中间
    cut2 = data.index("世".encode()) + 1
    pieces = [data[:cut1], data[cut1:cut2], data[cut2:]]

    async def gen():
        for p in pieces:
            await asyncio.sleep(0.5)
            yield p

    return StreamingResponse(gen(), media_type="text/event-stream")

@app.post("/fake/explain")
async def fake_explain(body: ExplainIn, mode: str = "error"):
    async def gen():
        for w in ["This diff ", "changes ", "a check."]:
            await asyncio.sleep(0.5)
            yield sse({"type": "delta", "text": w})
        if mode == "error":
            # 4c: the backend reports an error inside the stream
            yield sse({"type": "error", "message": "The model failed. Try again."})
        # mode == "cut": 4e: just stop. No "done", no "error".
    return StreamingResponse(gen(), media_type="text/event-stream")

