from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .database import Base


# ──────────────────────────────────
# SQLAlchemy ORM 模型
# ──────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), default="新对话")
    model_name = Column(String(50), default=None)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")


# ──────────────────────────────────
# Pydantic 请求/响应模型
# ──────────────────────────────────

def _fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S") if dt else ""


# ── 通用 ──

class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Any = None


# ── 认证 ──

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=20)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthData(BaseModel):
    user_id: int
    username: str
    token: str


# ── 会话 ──

class ConversationCreate(BaseModel):
    title: str = "新对话"
    model_name: str = ""


class ConversationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class ConversationOut(BaseModel):
    id: int
    title: str
    model_name: str
    created_at: str
    updated_at: str

    @classmethod
    def from_orm_obj(cls, conv: Conversation) -> "ConversationOut":
        return cls(
            id=conv.id,
            title=conv.title,
            model_name=conv.model_name,
            created_at=_fmt(conv.created_at),
            updated_at=_fmt(conv.updated_at),
        )


class ConversationListData(BaseModel):
    list: list[ConversationOut]
    total: int
    page: int
    limit: int


# ── 消息 ──

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1)


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

    @classmethod
    def from_orm_obj(cls, msg: Message) -> "MessageOut":
        return cls(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=_fmt(msg.created_at),
        )


class MessageListData(BaseModel):
    list: list[MessageOut]
    total: int
    page: int
    limit: int
