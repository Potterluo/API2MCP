import aiohttp

from fastapi import FastAPI, HTTPException
from mcp.server.fastmcp import FastMCP
from typing import Dict, Any

# 初始化MCP服务器
mcp = FastMCP("API2MCP-mcp-server")


@mcp.tool()
def clac_bmi(height, weight):
    """
    根据身高体重计算BMI值
    """
    return weight / (height / 100) ** 2


@mcp.tool()
async def get_ip() -> Dict[str, Any]:
    """
    获取当前所在位置的IP地址及城市、经纬度等信息
    """
    # 定义 API URL 为常量，便于维护
    API_URL = "https://realip.cc"

    try:
        # 使用 aiohttp 进行异步请求
        async with aiohttp.ClientSession() as session:
            async with session.get(API_URL, timeout=5) as response:
                # 检查 HTTP 响应状态码
                if response.status != 200:
                    raise ValueError(f"Unexpected HTTP status code: {response.status}")

                # 解析并返回 JSON 数据
                data = await response.json()
                return data

    except aiohttp.ClientError as e:
        # 捕获网络相关异常
        print(f"Network error occurred: {e}")
        return {"error": "Network error"}
    except ValueError as e:
        # 捕获非 200 状态码或其他解析错误
        print(f"Value error occurred: {e}")
        return {"error": str(e)}
    except Exception as e:
        # 捕获其他未知异常
        print(f"An unexpected error occurred: {e}")
        return {"error": "Unexpected error"}


@mcp.tool()
def read_file(file_path: str) -> str:
    """
    根据给定文件路径读取文件内容
    """
    try:
        # 明确指定编码为 UTF-8，避免潜在的解码问题
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()
    except Exception as e:
        # 捕获其他未知异常
        return f"An unexpected error occurred while reading file at path '{file_path}': {e}"


@mcp.tool()
def write_file(file_path: str, content: str) -> str:
    """
    将内容写入指定文件路径
    """
    try:
        # 明确指定编码为 UTF-8，避免潜在的解码问题
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(content)
        return f"Successfully wrote content to file at path '{file_path}'."
    except Exception as e:
        # 捕获其他未知异常
        return f"An unexpected error occurred while writing file at path '{file_path}': {e}"


app = FastAPI()
# 挂载SSE服务器
app.mount("/", mcp.sse_app())
