from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .routers import auth, conversations, messages

app = FastAPI(title="AI Fitness API")

# 挂载前端静态文件
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/css", StaticFiles(directory=frontend_dir / "css"), name="css")
app.mount("/js", StaticFiles(directory=frontend_dir / "js"), name="js")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": exc.detail, "data": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"code": 400, "message": "请求参数错误", "data": None},
    )


app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["会话"])
app.include_router(messages.router, prefix="/api/conversations", tags=["消息"])

@app.get("/")
def read_root():
    return FileResponse(frontend_dir / "index.html")
