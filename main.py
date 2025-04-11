from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.routing import Mount
from starlette.requests import Request
from mcp.server.fastmcp import FastMCP
import requests
import yaml
from typing import Any, Dict, List
from pydantic import BaseModel

# 定义API服务模型
class ServiceModel(BaseModel):
    name: str
    description: str = ""
    auth_type: str
    auth_config: Dict[str, Any] = {}
    endpoint: str
    request: Dict[str, Any] = {"method": "GET", "params": {}}
    is_active: bool = True

# 初始化MCP服务器
mcp = FastMCP("API2MCP-mcp-server")

def load_config() -> Dict[str, Any]:
    """加载配置文件"""
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def create_api_tool(service_config: Dict[str, Any]):
    """根据服务配置创建API工具函数"""
    request_params = service_config.get('request', {}).get('params', {})
    
    # 动态创建函数签名
    param_names = list(request_params.keys())
    param_str = ', '.join(param_names) if param_names else ''
    
    # 创建函数体
    exec_globals = {}
    
    async def api_tool_impl(**kwargs) -> str:
        url = service_config['endpoint']
        auth_params = service_config.get('auth_config', {})
        request_config = service_config.get('request', {'method': 'GET', 'params': {}})
        
        # 合并认证参数和请求参数
        params = {}
        headers = {}
        
        # 处理认证信息
        if service_config['auth_type'] == 'basic':
            import base64
            auth_str = base64.b64encode(f"{auth_params.get('username', '')}:{auth_params.get('password', '')}".encode()).decode()
            headers['Authorization'] = f'Basic {auth_str}'
        elif service_config['auth_type'] == 'token':
            token_type = auth_params.get('token_type', 'Bearer')
            token = auth_params.get('token', '')
            if token_type:
                headers['Authorization'] = f'{token_type} {token}'
            else:
                headers['Authorization'] = token
        elif service_config['auth_type'] == 'oauth':
            headers['Authorization'] = f'Bearer {auth_params.get("access_token", "")}'
        
        # 处理请求参数
        for param_name, param_value in request_config['params'].items():
            params[param_name] = kwargs.get(param_name, param_value)
        
        try:
            method = request_config.get('method', 'GET').upper()
            if method == 'GET':
                response = requests.get(url, params=params, headers=headers, timeout=5)
            elif method == 'POST':
                response = requests.post(url, json=params, headers=headers, timeout=5)
            else:
                return json.dumps({"error": f"不支持的请求方法：{method}"})
            
            try:
                return json.dumps(response.json())
            except ValueError:
                return json.dumps({"result": response.text})
        except requests.exceptions.RequestException as e:
            return json.dumps({"error": str(e)})
    
    # 将api_tool_impl添加到exec_globals中
    exec_globals['api_tool_impl'] = api_tool_impl
    
    # 创建具有正确参数的函数
    func_name = service_config['name']
    exec(f"async def {func_name}({param_str}) -> str: return await api_tool_impl({', '.join(f'{p}={p}' for p in param_names)})" if param_names else f"async def {func_name}() -> str: return await api_tool_impl()", exec_globals)
    
    # 获取生成的函数
    api_tool = exec_globals[func_name]
    api_tool.__doc__ = service_config.get('description', '')
    return api_tool

# 加载配置文件
config = load_config()

# 动态注册API工具
for service in config.get('api_services', []):
    if service.get('is_active', False):
        # 获取请求参数
        request_params = service.get('request', {}).get('params', {})
        # 创建API工具函数并注册
        tool_func = create_api_tool(service)
        # 使用装饰器注册工具
        mcp.tool()(tool_func)

# 初始化FastAPI应用
app = FastAPI()

# 配置静态文件和模板
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# 挂载SSE服务器
app.mount("/sse", mcp.sse_app())

# 主页路由
@app.get("/")
async def index(request: Request):
    config = load_config()
    return templates.TemplateResponse("index.html", {
        "request": request,
        "services": config.get("api_services", [])
    })

# API路由
@app.get("/api/services")
async def get_services():
    config = load_config()
    return config.get("api_services", [])

@app.get("/api/services/{service_name}")
async def get_service(service_name: str):
    config = load_config()
    for service in config.get("api_services", []):
        if service["name"] == service_name:
            return service
    raise HTTPException(status_code=404, detail="Service not found")

@app.post("/api/services")
async def create_service(service: ServiceModel):
    if not service.name or not service.endpoint or not service.auth_type:
        raise HTTPException(status_code=400, detail="Missing required fields: name, endpoint, and auth_type are required")
    
    config = load_config()
    
    # 检查服务名是否已存在
    for existing_service in config.get("api_services", []):
        if existing_service["name"] == service.name:
            raise HTTPException(status_code=400, detail="Service name already exists")
    
    # 添加新服务
    service_dict = service.dict()
    if "api_services" not in config:
        config["api_services"] = []
    config["api_services"].append(service_dict)
    
    # 保存配置
    save_config(config)
    return service_dict

@app.post("/api/services/refresh")
async def refresh_services():
    config = load_config()
    
    # 重新加载所有服务
    for service in config.get("api_services", []):
        try:
            create_api_tool(service)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to refresh service {service['name']}: {str(e)}")
    
    return {"message": "All services refreshed successfully"}

@app.put("/api/services/{service_name}")
async def update_service(service_name: str, service: ServiceModel):
    config = load_config()
    
    # 查找并更新服务
    for i, existing_service in enumerate(config.get("api_services", [])):
        if existing_service["name"] == service_name:
            service_dict = service.dict()
            config["api_services"][i] = service_dict
            save_config(config)
            return service_dict
    
    raise HTTPException(status_code=404, detail="Service not found")

@app.delete("/api/services/{service_name}")
async def delete_service(service_name: str):
    config = load_config()
    
    # 查找并删除服务
    for i, service in enumerate(config.get("api_services", [])):
        if service["name"] == service_name:
            del config["api_services"][i]
            save_config(config)
            return {"message": "Service deleted"}
    
    raise HTTPException(status_code=404, detail="Service not found")

@app.post("/api/services/{service_name}/test")
async def test_service(service_name: str, params: Dict[str, Any]):
    config = load_config()
    
    # 查找服务
    service = None
    for s in config.get("api_services", []):
        if s["name"] == service_name:
            service = s
            break
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # 创建工具函数并执行测试
    tool_func = create_api_tool(service)
    try:
        result = await tool_func(**params)
        # 尝试解析JSON字符串
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def save_config(config: Dict[str, Any]):
    """保存配置文件"""
    with open('config.yaml', 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, sort_keys=False)