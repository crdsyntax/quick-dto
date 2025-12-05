import * as vscode from 'vscode';
import { HttpTesterGenerator, HttpRequest, HttpResponse } from '../generators/http-tester.generator';

export class HttpTesterPanel {
    public static currentPanel: HttpTesterPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private readonly _generator = HttpTesterGenerator.getInstance();

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview();
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static createOrShow() {
        const extensionUri = vscode.Uri.file(__dirname);
        
        if (HttpTesterPanel.currentPanel) {
            HttpTesterPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'httpTester',
            'HTTP Tester',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        HttpTesterPanel.currentPanel = new HttpTesterPanel(panel, extensionUri);
    }

    private _getHtmlForWebview() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>HTTP Tester</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        padding: 20px;
                        background-color: #1e1e1e;
                        color: #d4d4d4;
                    }
                    
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    
                    .request-section, .response-section {
                        background-color: #252526;
                        border-radius: 6px;
                        padding: 20px;
                        margin-bottom: 20px;
                        border: 1px solid #3e3e42;
                    }
                    
                    .section-title {
                        font-size: 16px;
                        font-weight: 600;
                        margin-bottom: 15px;
                        color: #ffffff;
                        display: flex;
                        align-items: center;
                    }
                    
                    .section-title i {
                        margin-right: 8px;
                    }
                    
                    .form-group {
                        margin-bottom: 15px;
                    }
                    
                    .form-row {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    
                    .form-control {
                        flex: 1;
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-size: 13px;
                        color: #cccccc;
                    }
                    
                    input, select, textarea {
                        width: 100%;
                        padding: 8px 12px;
                        background-color: #3c3c3c;
                        border: 1px solid #3e3e42;
                        border-radius: 4px;
                        color: #d4d4d4;
                        font-size: 13px;
                    }
                    
                    input:focus, select:focus, textarea:focus {
                        outline: none;
                        border-color: #007acc;
                    }
                    
                    textarea {
                        resize: vertical;
                        min-height: 100px;
                        font-family: 'Consolas', 'Monaco', monospace;
                    }
                    
                    .btn {
                        padding: 8px 16px;
                        background-color: #007acc;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: background-color 0.2s;
                    }
                    
                    .btn:hover {
                        background-color: #005a9e;
                    }
                    
                    .btn-success {
                        background-color: #388a34;
                    }
                    
                    .btn-success:hover {
                        background-color: #2d6c2a;
                    }
                    
                    .btn-danger {
                        background-color: #c42b1c;
                    }
                    
                    .btn-danger:hover {
                        background-color: #a1261a;
                    }
                    
                    .btn-group {
                        display: flex;
                        gap: 10px;
                    }
                    
                    .auth-section {
                        background-color: #2d2d30;
                        padding: 15px;
                        border-radius: 4px;
                        margin-bottom: 15px;
                    }
                    
                    .auth-tabs {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    
                    .auth-tab {
                        padding: 6px 12px;
                        background-color: #3c3c3c;
                        border: 1px solid #3e3e42;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    
                    .auth-tab.active {
                        background-color: #007acc;
                        border-color: #007acc;
                    }
                    
                    .params-section {
                        margin-top: 20px;
                    }
                    
                    .param-row {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    
                    .param-row input {
                        flex: 1;
                    }
                    
                    .param-row .btn {
                        padding: 8px 12px;
                    }
                    
                    .response-info {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                        padding: 15px;
                        background-color: #2d2d30;
                        border-radius: 4px;
                    }
                    
                    .info-item {
                        text-align: center;
                    }
                    
                    .info-label {
                        font-size: 11px;
                        color: #888;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    
                    .info-value {
                        font-size: 18px;
                        font-weight: 600;
                    }
                    
                    .status-success {
                        color: #4ec9b0;
                    }
                    
                    .status-error {
                        color: #f14c4c;
                    }
                    
                    .status-info {
                        color: #569cd6;
                    }
                    
                    .tabs {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                        border-bottom: 1px solid #3e3e42;
                        padding-bottom: 10px;
                    }
                    
                    .tab {
                        padding: 8px 16px;
                        cursor: pointer;
                        border-radius: 4px 4px 0 0;
                    }
                    
                    .tab.active {
                        background-color: #007acc;
                    }
                    
                    .tab-content {
                        display: none;
                    }
                    
                    .tab-content.active {
                        display: block;
                    }
                    
                    .response-body {
                        white-space: pre-wrap;
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 12px;
                        line-height: 1.5;
                        padding: 15px;
                        background-color: #2d2d30;
                        border-radius: 4px;
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    
                    .headers-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    
                    .headers-table th, .headers-table td {
                        padding: 8px;
                        text-align: left;
                        border-bottom: 1px solid #3e3e42;
                        font-size: 12px;
                    }
                    
                    .headers-table th {
                        background-color: #2d2d30;
                        color: #cccccc;
                    }
                    
                    .status-indicator {
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        margin-right: 8px;
                    }
                    
                    .status-2xx { background-color: #4ec9b0; }
                    .status-3xx { background-color: #569cd6; }
                    .status-4xx { background-color: #ce9178; }
                    .status-5xx { background-color: #f14c4c; }
                    
                    .loading {
                        display: none;
                        text-align: center;
                        padding: 20px;
                        color: #569cd6;
                    }
                    
                    .loading.active {
                        display: block;
                    }
                    
                    .spinner {
                        border: 3px solid #3e3e42;
                        border-top: 3px solid #569cd6;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 10px;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="request-section">
                        <div class="section-title">
                            <i>📡</i> HTTP Request
                        </div>
                        
                        <div class="form-row">
                            <div class="form-control" style="flex: 0 0 120px;">
                                <label>Method</label>
                                <select id="method">
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="PATCH">PATCH</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="HEAD">HEAD</option>
                                    <option value="OPTIONS">OPTIONS</option>
                                </select>
                            </div>
                            <div class="form-control">
                                <label>URL</label>
                                <input type="text" id="url" placeholder="https://api.example.com/endpoint" />
                            </div>
                        </div>
                        
                        <div class="auth-section">
                            <div class="auth-tabs">
                                <div class="auth-tab active" data-auth="none">No Auth</div>
                                <div class="auth-tab" data-auth="bearer">Bearer Token</div>
                                <div class="auth-tab" data-auth="basic">Basic Auth</div>
                            </div>
                            
                            <div id="auth-none" class="auth-content">
                                <p>No authentication required</p>
                            </div>
                            
                            <div id="auth-bearer" class="auth-content" style="display: none;">
                                <div class="form-group">
                                    <label>Bearer Token</label>
                                    <input type="password" id="bearer-token" placeholder="Enter your bearer token" />
                                </div>
                            </div>
                            
                            <div id="auth-basic" class="auth-content" style="display: none;">
                                <div class="form-row">
                                    <div class="form-control">
                                        <label>Username</label>
                                        <input type="text" id="basic-username" placeholder="Username" />
                                    </div>
                                    <div class="form-control">
                                        <label>Password</label>
                                        <input type="password" id="basic-password" placeholder="Password" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="params-section">
                            <label>Query Parameters</label>
                            <div id="query-params-container">
                                <div class="param-row">
                                    <input type="text" placeholder="Key" class="param-key" />
                                    <input type="text" placeholder="Value" class="param-value" />
                                    <button class="btn btn-danger remove-param">×</button>
                                </div>
                            </div>
                            <button class="btn" id="add-param">Add Parameter</button>
                        </div>
                        
                        <div class="form-group">
                            <label>Headers</label>
                            <div id="headers-container">
                                <div class="param-row">
                                    <input type="text" placeholder="Header Name" class="header-key" value="Content-Type" />
                                    <input type="text" placeholder="Header Value" class="header-value" value="application/json" />
                                    <button class="btn btn-danger remove-header">×</button>
                                </div>
                            </div>
                            <button class="btn" id="add-header">Add Header</button>
                        </div>
                        
                        <div class="form-group">
                            <label>Body</label>
                            <textarea id="body" placeholder='{"key": "value"}'></textarea>
                        </div>
                        
                        <div class="btn-group">
                            <button class="btn btn-success" id="send-request">
                                <i>▶</i> Send Request
                            </button>
                            <button class="btn" id="clear-request">Clear</button>
                        </div>
                    </div>
                    
                    <div class="response-section">
                        <div class="section-title">
                            <i>📥</i> Response
                        </div>
                        
                        <div class="loading" id="loading">
                            <div class="spinner"></div>
                            <p>Sending request...</p>
                        </div>
                        
                        <div id="response-content" style="display: none;">
                            <div class="response-info">
                                <div class="info-item">
                                    <div class="info-label">Status</div>
                                    <div class="info-value" id="status-code"></div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Time</div>
                                    <div class="info-value" id="response-time">0 ms</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Size</div>
                                    <div class="info-value" id="response-size">0 B</div>
                                </div>
                            </div>
                            
                            <div class="tabs">
                                <div class="tab active" data-tab="body">Body</div>
                                <div class="tab" data-tab="headers">Headers</div>
                                <div class="tab" data-tab="raw">Raw</div>
                            </div>
                            
                            <div class="tab-content active" id="tab-body">
                                <div class="response-body" id="response-body"></div>
                            </div>
                            
                            <div class="tab-content" id="tab-headers">
                                <table class="headers-table" id="headers-table">
                                    <thead>
                                        <tr>
                                            <th>Header</th>
                                            <th>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody id="headers-body">
                                        <!-- Headers will be inserted here -->
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="tab-content" id="tab-raw">
                                <div class="response-body" id="raw-response"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // DOM Elements
                    const methodSelect = document.getElementById('method');
                    const urlInput = document.getElementById('url');
                    const bodyTextarea = document.getElementById('body');
                    const sendButton = document.getElementById('send-request');
                    const clearButton = document.getElementById('clear-request');
                    const loadingDiv = document.getElementById('loading');
                    const responseContent = document.getElementById('response-content');
                    const statusCode = document.getElementById('status-code');
                    const responseTime = document.getElementById('response-time');
                    const responseSize = document.getElementById('response-size');
                    const responseBody = document.getElementById('response-body');
                    const rawResponse = document.getElementById('raw-response');
                    const headersBody = document.getElementById('headers-body');
                    const authTabs = document.querySelectorAll('.auth-tab');
                    const authContents = document.querySelectorAll('.auth-content');
                    const tabs = document.querySelectorAll('.tab');
                    const tabContents = document.querySelectorAll('.tab-content');
                    
                    // Initialize
                    let currentAuthType = 'none';
                    
                    // Auth tab switching
                    authTabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            const authType = tab.dataset.auth;
                            switchAuthTab(authType);
                        });
                    });
                    
                    // Response tab switching
                    tabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            const tabName = tab.dataset.tab;
                            switchResponseTab(tabName);
                        });
                    });
                    
                    // Add parameter row
                    document.getElementById('add-param').addEventListener('click', () => {
                        addParamRow();
                    });
                    
                    // Add header row
                    document.getElementById('add-header').addEventListener('click', () => {
                        addHeaderRow();
                    });
                    
                    // Send request
                    sendButton.addEventListener('click', sendRequest);
                    
                    // Clear request
                    clearButton.addEventListener('click', clearRequest);
                    
                    // Keyboard shortcut for sending request
                    document.addEventListener('keydown', (e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            sendRequest();
                        }
                    });
                    
                    // Functions
                    function switchAuthTab(authType) {
                        currentAuthType = authType;
                        
                        // Update tabs
                        authTabs.forEach(tab => {
                            if (tab.dataset.auth === authType) {
                                tab.classList.add('active');
                            } else {
                                tab.classList.remove('active');
                            }
                        });
                        
                        // Update content
                        authContents.forEach(content => {
                            if (content.id === \`auth-\${authType}\`) {
                                content.style.display = 'block';
                            } else {
                                content.style.display = 'none';
                            }
                        });
                    }
                    
                    function switchResponseTab(tabName) {
                        // Update tabs
                        tabs.forEach(tab => {
                            if (tab.dataset.tab === tabName) {
                                tab.classList.add('active');
                            } else {
                                tab.classList.remove('active');
                            }
                        });
                        
                        // Update content
                        tabContents.forEach(content => {
                            if (content.id === \`tab-\${tabName}\`) {
                                content.classList.add('active');
                            } else {
                                content.classList.remove('active');
                            }
                        });
                    }
                    
                    function addParamRow(key = '', value = '') {
                        const container = document.getElementById('query-params-container');
                        const row = document.createElement('div');
                        row.className = 'param-row';
                        row.innerHTML = \`
                            <input type="text" placeholder="Key" class="param-key" value="\${key}" />
                            <input type="text" placeholder="Value" class="param-value" value="\${value}" />
                            <button class="btn btn-danger remove-param">×</button>
                        \`;
                        container.appendChild(row);
                        
                        // Add remove event
                        row.querySelector('.remove-param').addEventListener('click', () => {
                            row.remove();
                        });
                    }
                    
                    function addHeaderRow(key = '', value = '') {
                        const container = document.getElementById('headers-container');
                        const row = document.createElement('div');
                        row.className = 'param-row';
                        row.innerHTML = \`
                            <input type="text" placeholder="Header Name" class="header-key" value="\${key}" />
                            <input type="text" placeholder="Header Value" class="header-value" value="\${value}" />
                            <button class="btn btn-danger remove-header">×</button>
                        \`;
                        container.appendChild(row);
                        
                        // Add remove event
                        row.querySelector('.remove-header').addEventListener('click', () => {
                            row.remove();
                        });
                    }
                    
                    function collectQueryParams() {
                        const params = {};
                        const rows = document.querySelectorAll('#query-params-container .param-row');
                        rows.forEach(row => {
                            const key = row.querySelector('.param-key').value.trim();
                            const value = row.querySelector('.param-value').value.trim();
                            if (key) {
                                params[key] = value;
                            }
                        });
                        return params;
                    }
                    
                    function collectHeaders() {
                        const headers = {};
                        const rows = document.querySelectorAll('#headers-container .param-row');
                        rows.forEach(row => {
                            const key = row.querySelector('.header-key').value.trim();
                            const value = row.querySelector('.header-value').value.trim();
                            if (key) {
                                headers[key] = value;
                            }
                        });
                        return headers;
                    }
                    
                    function sendRequest() {
                        const request = {
                            url: urlInput.value.trim(),
                            method: methodSelect.value,
                            headers: collectHeaders(),
                            queryParams: collectQueryParams(),
                            body: bodyTextarea.value.trim(),
                            authType: currentAuthType
                        };
                        
                        // Add auth data
                        if (currentAuthType === 'bearer') {
                            request.authToken = document.getElementById('bearer-token').value;
                        } else if (currentAuthType === 'basic') {
                            request.basicUsername = document.getElementById('basic-username').value;
                            request.basicPassword = document.getElementById('basic-password').value;
                        }
                        
                        // Validate URL
                        if (!request.url) {
                            showError('Please enter a URL');
                            return;
                        }
                        
                        // Parse body if it's JSON
                        try {
                            if (request.body && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
                                request.body = JSON.parse(request.body);
                            }
                        } catch (error) {
                            // Keep as string if not valid JSON
                        }
                        
                        // Show loading
                        loadingDiv.classList.add('active');
                        responseContent.style.display = 'none';
                        
                        // Send to extension
                        vscode.postMessage({
                            command: 'sendRequest',
                            request: request
                        });
                    }
                    
                    function clearRequest() {
                        urlInput.value = '';
                        bodyTextarea.value = '';
                        document.getElementById('bearer-token').value = '';
                        document.getElementById('basic-username').value = '';
                        document.getElementById('basic-password').value = '';
                        
                        // Clear params
                        const paramContainer = document.getElementById('query-params-container');
                        paramContainer.innerHTML = '';
                        addParamRow();
                        
                        // Clear headers (keep Content-Type)
                        const headerContainer = document.getElementById('headers-container');
                        headerContainer.innerHTML = '';
                        addHeaderRow('Content-Type', 'application/json');
                        
                        // Clear response
                        responseContent.style.display = 'none';
                    }
                    
                    function showError(message) {
                        vscode.postMessage({
                            command: 'showError',
                            message: message
                        });
                    }
                    
                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.command) {
                            case 'response':
                                displayResponse(message.response);
                                break;
                            case 'error':
                                showError(message.error);
                                break;
                        }
                    });
                    
                    function displayResponse(response) {
                        // Hide loading
                        loadingDiv.classList.remove('active');
                        
                        // Update status
                        statusCode.textContent = response.status;
                                        statusCode.className = 'info-value ';
                        if (response.status >= 200 && response.status < 300) {
                            statusCode.classList.add('status-success');
                        } else if (response.status >= 400 && response.status < 500) {
                            statusCode.classList.add('status-error');
                        } else {
                            statusCode.classList.add('status-info');
                        }
                        
                        // Update time and size
                        responseTime.textContent = \`\${response.time} ms\`;
                        responseSize.textContent = formatSize(response.size);
                        
                        // Display formatted body
                        try {
                            const formatted = JSON.stringify(response.data, null, 2);
                            responseBody.textContent = formatted;
                        } catch {
                            responseBody.textContent = String(response.data);
                        }
                        
                        // Display raw response
                        rawResponse.textContent = JSON.stringify(response, null, 2);
                        
                        // Display headers
                        headersBody.innerHTML = '';
                        for (const [key, value] of Object.entries(response.headers)) {
                            const row = document.createElement('tr');
                            row.innerHTML = \`
                                <td>\${key}</td>
                                <td>\${value}</td>
                            \`;
                            headersBody.appendChild(row);
                        }
                        
                        // Show response
                        responseContent.style.display = 'block';
                        switchResponseTab('body');
                    }
                    
                    function formatSize(bytes) {
                        if (bytes === 0) return '0 B';
                        const k = 1024;
                        const sizes = ['B', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    }
                    
                    // Initialize with one param row
                    addParamRow();
                    
                    // Load saved state if any
                    const savedState = vscode.getState();
                    if (savedState) {
                        urlInput.value = savedState.url || '';
                        methodSelect.value = savedState.method || 'GET';
                        bodyTextarea.value = savedState.body || '';
                        
                        if (savedState.authType) {
                            switchAuthTab(savedState.authType);
                            if (savedState.authToken) {
                                document.getElementById('bearer-token').value = savedState.authToken;
                            }
                            if (savedState.basicUsername) {
                                document.getElementById('basic-username').value = savedState.basicUsername;
                            }
                        }
                    }
                    
                    // Save state on changes
                    [urlInput, methodSelect, bodyTextarea].forEach(element => {
                        element.addEventListener('input', saveState);
                    });
                    
                    function saveState() {
                        vscode.setState({
                            url: urlInput.value,
                            method: methodSelect.value,
                            body: bodyTextarea.value,
                            authType: currentAuthType,
                            authToken: document.getElementById('bearer-token').value,
                            basicUsername: document.getElementById('basic-username').value
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendRequest':
                        try {
                            const response = await this._generator.sendRequest(message.request);
                            webview.postMessage({
                                command: 'response',
                                response: response
                            });
                        } catch (error: any) {
                            webview.postMessage({
                                command: 'error',
                                error: error.message
                            });
                        }
                        break;
                    case 'showError':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    public dispose() {
        HttpTesterPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}