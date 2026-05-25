from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    ApiResponse,
    Conversation,
    ConversationCreate,
    ConversationListData,
    ConversationRename,
    ConversationOut,
    User,
)
from ..security import get_current_user

router = APIRouter()


@router.get("")
def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()

    return ApiResponse(
        data=ConversationListData(
            list=[ConversationOut.from_orm_obj(c) for c in items],
            total=total,
            page=page,
            limit=limit,
        ).model_dump(),
    )


@router.post("")
def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = Conversation(
        user_id=current_user.id,
        title=body.title,
        model_name=body.model_name,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ApiResponse(message="创建成功", data=ConversationOut.from_orm_obj(conv).model_dump())


@router.put("/{conversation_id}/title")
def rename_conversation(
    conversation_id: int,
    body: ConversationRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv is None:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "会话不存在", "data": None},
        )
    if conv.user_id != current_user.id:
        return JSONResponse(
            status_code=403,
            content={"code": 403, "message": "无权修改他人的会话", "data": None},
        )
    conv.title = body.title
    db.commit()
    return ApiResponse(message="重命名成功", data={"id": conv.id, "title": conv.title})


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv is None:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "会话不存在", "data": None},
        )
    if conv.user_id != current_user.id:
        return JSONResponse(
            status_code=403,
            content={"code": 403, "message": "无权删除他人的会话", "data": None},
        )
    db.delete(conv)
    db.commit()
    return ApiResponse(message="删除成功", data=None)
