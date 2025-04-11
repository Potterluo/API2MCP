// API2MCP 前端JS

document.addEventListener('DOMContentLoaded', function() {
    // 初始化事件监听器
    initEventListeners();
    
    // 加载认证类型相关UI
    initAuthTypeUI();

    // 初始化模态框事件
    initModalEvents();
});

// 初始化模态框事件
function initModalEvents() {
    // 添加服务按钮点击事件
    document.getElementById('addServiceBtn').addEventListener('click', function() {
        document.getElementById('serviceModal').classList.remove('hidden');
    });

    // 取消按钮点击事件
    document.getElementById('cancelBtn').addEventListener('click', function() {
        document.getElementById('serviceModal').classList.add('hidden');
    });

    // 关闭测试模态框
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('testModal').classList.add('hidden');
        });
    });
}

// 初始化事件监听器
function initEventListeners() {
    // 保存服务按钮
    const saveServiceBtn = document.getElementById('saveServiceBtn');
    if (saveServiceBtn) {
        saveServiceBtn.addEventListener('click', saveService);
    }
    
    // 认证类型选择变化
    const authTypeSelect = document.getElementById('authType');
    if (authTypeSelect) {
        authTypeSelect.addEventListener('change', updateAuthConfigUI);
    }
    
    // 编辑按钮
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const serviceName = this.getAttribute('data-service-name');
            editService(serviceName);
            document.getElementById('serviceModal').classList.remove('hidden');
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const serviceName = this.getAttribute('data-service-name');
            if (confirm('确定要删除该服务吗？')) {
                deleteService(serviceName);
            }
        });
    });
    
    // 测试按钮
    document.querySelectorAll('.test-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const serviceName = this.getAttribute('data-service-name');
            openTestModal(serviceName);
            document.getElementById('testModal').classList.remove('hidden');
        });
    });
    
    // 执行测试按钮
    const runTestBtn = document.getElementById('runTestBtn');
    if (runTestBtn) {
        runTestBtn.addEventListener('click', runServiceTest);
    }

    // 刷新按钮
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            window.location.reload();
        });
    }
}

// 初始化认证类型UI
function initAuthTypeUI() {
    const authTypeSelect = document.getElementById('authType');
    if (authTypeSelect) {
        updateAuthConfigUI();
    }
}

// 更新认证配置UI
function updateAuthConfigUI() {
    const authType = document.getElementById('authType').value;
    const container = document.getElementById('authConfigContainer');
    
    container.innerHTML = '';
    
    switch (authType) {
        case 'basic':
            container.innerHTML = `
                <div>
                    <label for="authUsername" class="block text-sm font-medium text-neutral-700">用户名</label>
                    <input type="text" id="authUsername" class="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                </div>
                <div>
                    <label for="authPassword" class="block text-sm font-medium text-neutral-700">密码</label>
                    <input type="password" id="authPassword" class="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                </div>
            `;
            break;
        case 'token':
            container.innerHTML = `
                <div>
                    <label for="authToken" class="block text-sm font-medium text-neutral-700">Token</label>
                    <input type="text" id="authToken" class="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                </div>
                <div>
                    <label for="authTokenType" class="block text-sm font-medium text-neutral-700">Token类型</label>
                    <select id="authTokenType" class="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                        <option value="Bearer">Bearer</option>
                        <option value="Basic">Basic</option>
                        <option value="">无前缀</option>
                    </select>
                </div>
            `;
            break;
        case 'oauth':
            container.innerHTML = `
                <div>
                    <label for="authAccessToken" class="block text-sm font-medium text-neutral-700">Access Token</label>
                    <input type="text" id="authAccessToken" class="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                </div>
            `;
            break;
        default:
            break;
    }
}

// 保存服务
async function saveService() {
    const serviceName = document.getElementById('serviceName').value;
    const serviceDescription = document.getElementById('serviceDescription').value;
    const serviceEndpoint = document.getElementById('serviceEndpoint').value;
    const authType = document.getElementById('authType').value;
    const isActive = document.getElementById('isActive').checked;
    
    // 验证必填字段
    if (!serviceName || !serviceEndpoint) {
        alert('请填写服务名称和端点');
        return;
    }
    
    // 获取认证配置
    let authConfig = {};
    switch (authType) {
        case 'basic':
            authConfig = {
                username: document.getElementById('authUsername').value,
                password: document.getElementById('authPassword').value
            };
            break;
        case 'token':
            authConfig = {
                token: document.getElementById('authToken').value,
                token_type: document.getElementById('authTokenType').value
            };
            break;
        case 'oauth':
            authConfig = {
                access_token: document.getElementById('authAccessToken').value
            };
            break;
    }
    
    // 构建服务对象
    const service = {
        name: serviceName,
        description: serviceDescription,
        auth_type: authType,
        auth_config: authConfig,
        endpoint: serviceEndpoint,
        request: {
            method: document.getElementById('requestMethod').value,
            params: JSON.parse(document.getElementById('requestParams').value || '{}')
        },
        is_active: isActive
    };
    
    try {
        // 发送请求
        const response = await fetch('/api/services', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(service)
        });
        
        if (response.ok) {
            // 关闭模态框并刷新页面
            const modal = bootstrap.Modal.getInstance(document.getElementById('addServiceModal'));
            modal.hide();
            window.location.reload();
        } else {
            const error = await response.json();
            alert(`保存失败: ${error.detail || '未知错误'}`);
        }
    } catch (error) {
        alert(`保存失败: ${error.message}`);
    }
}

// 编辑服务
async function editService(serviceName) {
    try {
        // 获取服务详情
        const response = await fetch(`/api/services/${serviceName}`);
        if (!response.ok) {
            throw new Error('获取服务详情失败');
        }
        
        const service = await response.json();
        
        // 填充表单
        document.getElementById('serviceName').value = service.name;
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('serviceEndpoint').value = service.endpoint;
        document.getElementById('authType').value = service.auth_type;
        document.getElementById('isActive').checked = service.is_active;
        document.getElementById('requestMethod').value = service.request?.method || 'GET';
        document.getElementById('requestParams').value = JSON.stringify(service.request?.params || {}, null, 2);
        
        // 更新认证配置UI
        updateAuthConfigUI();
        
        // 填充认证配置
        setTimeout(() => {
            switch (service.auth_type) {
                case 'basic':
                    if (document.getElementById('authUsername')) {
                        document.getElementById('authUsername').value = service.auth_config.username || '';
                        document.getElementById('authPassword').value = service.auth_config.password || '';
                    }
                    break;
                case 'token':
                    if (document.getElementById('authToken')) {
                        document.getElementById('authToken').value = service.auth_config.token || '';
                        document.getElementById('authTokenType').value = service.auth_config.token_type || 'Bearer';
                    }
                    break;
                case 'oauth':
                    if (document.getElementById('authAccessToken')) {
                        document.getElementById('authAccessToken').value = service.auth_config.access_token || '';
                    }
                    break;
            }
        }, 100);
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('addServiceModal'));
        modal.show();
        
        // 修改保存按钮行为
        const saveBtn = document.getElementById('saveServiceBtn');
        saveBtn.onclick = async function() {
            // 获取表单数据
            const updatedService = {
                name: document.getElementById('serviceName').value,
                description: document.getElementById('serviceDescription').value,
                endpoint: document.getElementById('serviceEndpoint').value,
                auth_type: document.getElementById('authType').value,
                request: {
                    method: document.getElementById('requestMethod').value,
                    params: JSON.parse(document.getElementById('requestParams').value || '{}')
                },
                is_active: document.getElementById('isActive').checked,
                auth_config: {}
            };
            
            // 获取认证配置
            switch (updatedService.auth_type) {
                case 'basic':
                    updatedService.auth_config = {
                        username: document.getElementById('authUsername').value,
                        password: document.getElementById('authPassword').value
                    };
                    break;
                case 'token':
                    updatedService.auth_config = {
                        token: document.getElementById('authToken').value,
                        token_type: document.getElementById('authTokenType').value
                    };
                    break;
                case 'oauth':
                    updatedService.auth_config = {
                        access_token: document.getElementById('authAccessToken').value
                    };
                    break;
            }
            
            try {
                // 发送更新请求
                const response = await fetch(`/api/services/${serviceName}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedService)
                });
                
                if (response.ok) {
                    // 关闭模态框并刷新页面
                    modal.hide();
                    window.location.reload();
                } else {
                    const error = await response.json();
                    alert(`更新失败: ${error.detail || '未知错误'}`);
                }
            } catch (error) {
                alert(`更新失败: ${error.message}`);
            }
        };
    } catch (error) {
        alert(`加载服务详情失败: ${error.message}`);
    }
}

// 删除服务
async function deleteService(serviceName) {
    if (!confirm(`确定要删除服务 ${serviceName} 吗？`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/services/${serviceName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            const error = await response.json();
            alert(`删除失败: ${error.detail || '未知错误'}`);
        }
    } catch (error) {
        alert(`删除失败: ${error.message}`);
    }
}

// 打开测试模态框
function openTestModal(serviceName) {
    document.getElementById('testServiceName').value = serviceName;
    document.getElementById('testParams').value = '{}';
    document.getElementById('testResult').textContent = '点击测试按钮获取结果';
    
    const modal = new bootstrap.Modal(document.getElementById('testServiceModal'));
    modal.show();
}

// 运行服务测试
async function runServiceTest() {
    const serviceName = document.getElementById('testServiceName').value;
    let params;
    
    try {
        params = JSON.parse(document.getElementById('testParams').value);
    } catch (error) {
        alert('参数格式错误，请输入有效的JSON');
        return;
    }
    
    const resultElement = document.getElementById('testResult');
    resultElement.textContent = '正在测试...';
    
    try {
        // 调用测试API
        const response = await fetch(`/api/services/${serviceName}/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        
        const result = await response.json();
        resultElement.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
        resultElement.textContent = `测试失败: ${error.message}`;
    }
}

// 刷新API服务
async function refreshServices() {
    try {
        const response = await fetch('/api/services/refresh', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            window.location.reload();
        } else {
            const error = await response.json();
            alert(`刷新失败: ${error.detail || '未知错误'}`);
        }
    } catch (error) {
        alert(`刷新失败: ${error.message}`);
    }
}