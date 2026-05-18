import { vscodeApi } from '../core/vscodeApi.js';
import { stateManager } from '../core/stateManager.js';
import { uiUtils } from '../ui/domUtils.js';

export class HttpModule {
    constructor() {
        this.urlInput = document.getElementById("url-input");
        this.methodSelect = document.getElementById("method-select");
        this.bodyTextarea = document.getElementById("body-textarea");
        this.sendButton = document.getElementById("send-button");
        this.paramsContainer = document.getElementById("params-container");
        this.addParamButton = document.getElementById("add-param-button");
        this.headersContainer = document.getElementById("headers-container");
        this.addHeaderButton = document.getElementById("add-header-button");
        this.filesContainer = document.getElementById("files-container");
        this.addFileButton = document.getElementById("add-file-button");
        this.repeatButton = document.getElementById("repeat-button");
        this.repeatCountInput = document.getElementById("repeat-count");
        this.contentTypeSelect = document.getElementById("content-type-select");
        
        this.httpContentTabs = document.querySelectorAll(".http-tabs button");
        this.httpContentAreas = document.querySelectorAll("#http-tab > .auth-content");
        
        this.currentAuthType = "none";
        
        this.initEventListeners();
    }

    initEventListeners() {
        this.addParamButton.addEventListener("click", () => {
            this.addRow(this.paramsContainer, "param");
            this.saveState();
        });

        this.addHeaderButton.addEventListener("click", () => {
            this.addRow(this.headersContainer, "header");
            this.saveState();
        });

        this.addFileButton.addEventListener("click", () => {
            this.addFileRow();
        });

        this.httpContentTabs.forEach((button) => {
            button.addEventListener("click", (e) => {
                const target = e.target.getAttribute("data-auth");
                this.httpContentTabs.forEach((btn) => btn.classList.remove("active"));
                e.target.classList.add("active");
                this.httpContentAreas.forEach((content) => {
                    if (content.id === `${target}-content`) {
                        content.classList.add("active");
                    } else {
                        content.classList.remove("active");
                    }
                });
            });
        });

        document.querySelectorAll("#auth-content .tab-auth-header button[data-auth-type]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const type = e.target.getAttribute("data-auth-type");
                this.switchAuthTab(type);
            });
        });

        this.sendButton.addEventListener("click", () => this.sendRequest());

        this.repeatButton.addEventListener("click", () => {
            const repeatCount = parseInt(this.repeatCountInput.value) || 1;
            if (repeatCount < 1 || repeatCount > 1000) {
                alert("Repeat count must be between 1 and 1000");
                return;
            }
            this.sendRequest(repeatCount);
        });

        // Save state on inputs
        [
            this.urlInput,
            this.methodSelect,
            this.bodyTextarea,
            document.getElementById("bearer-token"),
            document.getElementById("basic-username"),
            document.getElementById("basic-password"),
        ].forEach((element) => {
            element?.addEventListener("input", () => this.saveState());
        });
    }

    addRow(container, type, key = "", value = "") {
        const row = document.createElement("div");
        row.className = `${type}-row`;

        const sanitizedKey = key.replace(/"/g, "&quot;");
        const sanitizedValue = value.replace(/"/g, "&quot;");

        row.innerHTML = `
            <input type="text" class="${type}-key" placeholder="${type} Key" value="${sanitizedKey}" />
            <input type="text" class="${type}-value" placeholder="${type} Value" value="${sanitizedValue}" />
            <button class="remove-button" onclick="this.parentNode.remove(); window.dispatchEvent(new Event('httpStateChange'));">
                &times;
            </button>
        `;

        row.querySelector(`.${type}-key`).addEventListener("input", () => this.saveState());
        row.querySelector(`.${type}-value`).addEventListener("input", () => this.saveState());

        container.appendChild(row);
    }

    addFileRow(fieldName = "", fileName = "", fileData = "") {
        const row = document.createElement("div");
        row.className = "param-row";

        row.innerHTML = `
            <input type="text" class="file-field-name" placeholder="Field Name" value="${fieldName}" />
            <input type="file" class="file-input" style="font-size: 12px;" />
            <button class="remove-button" onclick="this.parentNode.remove();">
                &times;
            </button>
        `;

        const fileInput = row.querySelector(".file-input");
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result.split(",")[1];
                    fileInput.dataset.fileData = base64;
                    fileInput.dataset.fileName = file.name;
                };
                reader.readAsDataURL(file);
            }
        });

        this.filesContainer.appendChild(row);
    }

    collectQueryParams() {
        const params = [];
        this.paramsContainer.querySelectorAll(".param-row").forEach((row) => {
            const key = row.querySelector(".param-key").value.trim();
            const value = row.querySelector(".param-value").value.trim();
            if (key) {
                params.push({ key: key, value: value });
            }
        });
        return params;
    }

    collectHeaders() {
        const headers = [];
        this.headersContainer.querySelectorAll(".header-row").forEach((row) => {
            const key = row.querySelector(".header-key").value.trim();
            const value = row.querySelector(".header-value").value.trim();
            if (key) {
                headers.push({ key: key, value: value });
            }
        });
        return headers;
    }

    collectFiles() {
        const files = [];
        this.filesContainer.querySelectorAll(".param-row").forEach((row) => {
            const fieldName = row.querySelector(".file-field-name").value.trim();
            const fileInput = row.querySelector(".file-input");
            const fileData = fileInput.dataset.fileData;
            const fileName = fileInput.dataset.fileName;

            if (fieldName && fileData) {
                files.push({
                    fieldName: fieldName,
                    fileName: fileName,
                    fileData: fileData,
                });
            }
        });
        return files;
    }

    switchAuthTab(type) {
        this.currentAuthType = type;
        document.querySelectorAll("#auth-content .tab-auth-header button[data-auth-type]").forEach((btn) => btn.classList.remove("active"));
        document.querySelector(`#auth-content .tab-auth-header button[data-auth-type="${type}"]`).classList.add("active");

        document.querySelectorAll("#auth-content > .auth-content").forEach((div) => {
            div.classList.remove("active");
        });
        document.getElementById(`auth-${type}`).classList.add("active");
        this.saveState();
    }

    parseBody(body) {
        if (!body || body.trim() === "") return null;
        try {
            return JSON.parse(body);
        } catch (e) {
            return body;
        }
    }

    buildRequestObject() {
        return {
            type: "http",
            url: this.urlInput.value.trim(),
            method: this.methodSelect.value,
            headers: this.collectHeaders().reduce((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {}),
            queryParams: this.collectQueryParams().reduce((acc, item) => {
                if (acc[item.key]) {
                    if (Array.isArray(acc[item.key])) {
                        acc[item.key].push(item.value);
                    } else {
                        acc[item.key] = [acc[item.key], item.value];
                    }
                } else {
                    acc[item.key] = item.value;
                }
                return acc;
            }, {}),
            body: this.parseBody(this.bodyTextarea.value),
            authType: this.currentAuthType,
            authToken: document.getElementById("bearer-token").value,
            basicUsername: document.getElementById("basic-username").value,
            basicPassword: document.getElementById("basic-password").value,
            contentType: this.contentTypeSelect.value,
            files: this.collectFiles(),
        };
    }

    sendRequest(repeatCount = 0) {
        const request = this.buildRequestObject();

        if (!request.url) {
            uiUtils.showError("Please enter a URL");
            return;
        }

        uiUtils.startLoading();

        if (repeatCount > 0) {
            vscodeApi.postMessage({
                command: "repeatRequest",
                request: request,
                repeatCount: repeatCount,
            });
        } else {
            vscodeApi.postMessage({
                command: "sendRequest",
                request: request,
            });
        }

        this.saveState();
    }

    getCurrentState() {
        return {
            type: "http",
            url: this.urlInput.value.trim(),
            method: this.methodSelect.value,
            body: this.bodyTextarea.value,
            queryParams: this.collectQueryParams(),
            headers: this.collectHeaders(),
            authType: this.currentAuthType,
            authToken: document.getElementById("bearer-token").value,
            basicUsername: document.getElementById("basic-username").value,
            basicPassword: document.getElementById("basic-password").value,
        };
    }

    saveState() {
        stateManager.saveHttpRequestState(this.getCurrentState());
    }

    loadKeyValuesToContainer(container, keyValues, type) {
        container.innerHTML = "";
        if (keyValues && keyValues.length > 0) {
            keyValues.forEach((item) => {
                this.addRow(container, type, item.key || "", item.value || "");
            });
        }
        if (type === "param" && container.children.length === 0) {
            this.addRow(container, type);
        }
    }

    applyState(state) {
        this.urlInput.value = state.url || "";
        this.methodSelect.value = state.method || "GET";
        this.bodyTextarea.value = state.body || "";

        this.loadKeyValuesToContainer(this.paramsContainer, state.queryParams || [], "param");
        this.loadKeyValuesToContainer(this.headersContainer, state.headers || [], "header");

        this.switchAuthTab(state.authType || "none");
        document.getElementById("bearer-token").value = state.authToken || "";
        document.getElementById("basic-username").value = state.basicUsername || "";
        document.getElementById("basic-password").value = state.basicPassword || "";
        
        this.saveState();
    }
}
