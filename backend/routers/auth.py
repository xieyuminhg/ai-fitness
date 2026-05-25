from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RegisterRequest, LoginRequest, AuthData, ApiResponse, User
from ..security import create_token, hash_password, verify_password

router = APIRouter()


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        return JSONResponse(
            status_code=400,
            content={"code": 400, "message": "用户名已存在", "data": None},
        )

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id, user.username)
    return ApiResponse(
        code=200,
        message="注册成功",
        data=AuthData(user_id=user.id, username=user.username, token=token).model_dump(),
    )


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if not body.username or not body.password:
        return JSONResponse(
            status_code=400,
            content={"code": 400, "message": "用户名或密码不能为空", "data": None},
        )

    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not verify_password(body.password, user.password_hash):
        return JSONResponse(
            status_code=401,
            content={"code": 401, "message": "用户名不存在或密码错误", "data": None},
        )

    token = create_token(user.id, user.username)
    return ApiResponse(
        code=200,
        message="登录成功",
        data=AuthData(user_id=user.id, username=user.username, token=token).model_dump(),
    )
