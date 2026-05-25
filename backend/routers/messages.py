import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    ApiResponse,
    Conversation,
    Message,
    MessageListData,
    MessageOut,
    SendMessageRequest,
    User,
)
from ..security import get_current_user

router = APIRouter()

SYSTEM_PROMPT = (
    "你是一个专业的 AI 健身助手。你会根据用户的个人情况（身高、体重、年龄、运动习惯等）"
    "提供个性化的健身建议、饮食指导和训练计划。请保持专业、友好、鼓励的态度。"
    "如果用户提供的信息不足以给出建议，请主动询问缺失的信息。"
)


def _get_conv_or_404(conversation_id: int, user_id: int, db: Session) -> Conversation:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    if conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权访问此会话")
    return conv


@router.get("/{conversation_id}/messages")
def list_messages(
    conversation_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_conv_or_404(conversation_id, current_user.id, db)

    q = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()

    return ApiResponse(
        data=MessageListData(
            list=[MessageOut.from_orm_obj(m) for m in items],
            total=total,
            page=page,
            limit=limit,
        ).model_dump(),
    )


@router.post("/{conversation_id}/messages")
def send_message(
    conversation_id: int,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_conv_or_404(conversation_id, current_user.id, db)

    # 保存用户消息
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 构建 AI 上下文
    history = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    ai_messages = []
    for m in history:
        ai_messages.append({"role": m.role, "content": m.content})

    # 调用 Anthropic API
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                f"{settings.anthropic_base_url}/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_auth_token,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.anthropic_model,
                    "max_tokens": 2048,
                    "system": SYSTEM_PROMPT,
                    "messages": ai_messages,
                },
            )
            if resp.status_code != 200:
                return JSONResponse(
                    status_code=500,
                    content={"code": 500, "message": f"AI 接口调用失败: {resp.status_code}", "data": None},
                )
            for block in resp.json()["content"]:
                if block["type"] == "text":
                    ai_content = block["text"]
                    break
            else:
                return JSONResponse(
                    status_code=500,
                    content={"code": 500, "message": "AI 未返回文本回复", "data": None},
                )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"code": 500, "message": f"AI 接口调用失败: {str(e)}", "data": None},
        )

    # 保存 AI 回复
    ai_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=ai_content,
    )
    db.add(ai_msg)

    # 首次对话时自动生成标题
    if conv.title == "新对话":
        conv.title = body.content[:30] + ("..." if len(body.content) > 30 else "")

    db.commit()
    db.refresh(ai_msg)

    return ApiResponse(data=MessageOut.from_orm_obj(ai_msg).model_dump())
