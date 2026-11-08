"""HTTP layer: read the request, call a service, turn the result into a response."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas import ClassifyOut, DiffIn
from app.services import ClassifyError, classify, explain_stream

router = APIRouter()


@router.post("/explain/stream")
async def explain(body: DiffIn):
    # Don't await anything here: hand the generator to StreamingResponse, which pulls from it.
    return StreamingResponse(explain_stream(body.diff), media_type="text/event-stream")


@router.post("/classify", response_model=ClassifyOut)
async def classify_endpoint(body: DiffIn) -> ClassifyOut:
    try:
        return await classify(body.diff)
    except ClassifyError as e:
        raise HTTPException(status_code=502, detail=str(e))