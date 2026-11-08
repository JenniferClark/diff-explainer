"""Test-only endpoints that fake stream behavior, to check the frontend's error states."""
import asyncio

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas import DiffIn
from app.services import sse

router = APIRouter()

@router.post("/fake/explain")
async def fake_explain(body: DiffIn, mode: str = "error"):
    async def gen():
        for w in ["This diff ", "changes ", "a check."]:
            await asyncio.sleep(0.5)
            yield sse({"type": "delta", "text": w})
        if mode == "error":
            # 4c: the backend reports an error inside the stream
            yield sse({"type": "error", "message": "The model failed. Try again."})
        # mode == "cut": 4e: just stop. No "done", no "error".
    return StreamingResponse(gen(), media_type="text/event-stream")

@router.post("/fake/split")
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

@router.get("/fake/stream")
async def fake_stream():
    async def gen():
        for w in ["Hello", " from", " a", " fake", " stream"]:
            await asyncio.sleep(1)
            yield sse({"type": "delta", "text": w})

    return StreamingResponse(gen(), media_type="text/event-stream")
