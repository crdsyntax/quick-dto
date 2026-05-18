import { vscodeApi } from '../core/vscodeApi.js';
import { stateManager } from '../core/stateManager.js';

export class SocketModule {
    constructor() {
        this.socketUrlInput = document.getElementById("socket-url-input");
        this.socketPathInput = document.getElementById("socket-path-input");
        this.socketTokenInput = document.getElementById("socket-token-input");
        this.socketUserIdInput = document.getElementById("socket-user-id");
        this.socketConnectButton = document.getElementById("socket-connect-button");
        this.socketDisconnectButton = document.getElementById("socket-disconnect-button");
        this.socketStatusSpan = document.getElementById("socket-status");
        this.socketEventNameInput = document.getElementById("socket-event-name");
        this.socketPayloadTextarea = document.getElementById("socket-payload-textarea");
        this.socketEmitButton = document.getElementById("socket-emit-button");
        this.socketLogContainer = document.getElementById("socket-log-container");
        this.socketListenEventNameInput = document.getElementById("socket-listen-event-name");
        this.socketListenButton = document.getElementById("socket-listen-button");
        this.socketListenLogContainer = document.getElementById("socket-listen-log-container");
        this.clearListenLogButton = document.getElementById("clear-listen-log-button");
        this.clearSocketLogButton = document.getElementById("clear-socket-log-button");

        this.initEventListeners();
    }

    initEventListeners() {
        [
            this.socketUrlInput,
            this.socketPathInput,
            this.socketTokenInput,
            this.socketUserIdInput,
            this.socketEventNameInput,
            this.socketPayloadTextarea,
        ].forEach((element) => {
            element?.addEventListener("input", () => this.saveState());
        });

        this.socketConnectButton.addEventListener("click", () => {
            this.saveState();
            vscodeApi.postMessage({ command: "socketConnect", data: this.getCurrentState() });
        });

        this.socketDisconnectButton.addEventListener("click", () => {
            vscodeApi.postMessage({ command: "socketDisconnect" });
        });

        this.socketEmitButton.addEventListener("click", () => {
            this.saveState();
            const data = {
                eventName: this.socketEventNameInput.value,
                payload: this.socketPayloadTextarea.value,
            };
            vscodeApi.postMessage({ command: "socketEmit", data: data });
        });

        this.socketListenButton.addEventListener("click", () => {
            const data = {
                eventName: this.socketListenEventNameInput.value
            };
            vscodeApi.postMessage({ command: "socketListen", data: data });
        });

        this.clearListenLogButton.addEventListener("click", () => {
            this.socketListenLogContainer.innerHTML = "";
        });

        this.clearSocketLogButton.addEventListener("click", () => {
            this.socketLogContainer.innerHTML = "";
        });
        
        // Setup internal tabs
        const socketTabButtons = document.querySelectorAll(".socket-tab-btn");
        const socketTabContents = document.querySelectorAll(".socket-tab-content");

        socketTabButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.getAttribute("data-socket-tab");
                
                socketTabButtons.forEach((btn) => btn.classList.remove("active"));
                button.classList.add("active");

                socketTabContents.forEach((content) => {
                    if (content.id === `socket-${target}-tab`) {
                        content.classList.add("active");
                    } else {
                        content.classList.remove("active");
                    }
                });
            });
        });
    }

    getCurrentState() {
        return {
            type: "socket",
            url: this.socketUrlInput.value,
            token: this.socketTokenInput.value,
            userId: this.socketUserIdInput.value,
            eventName: this.socketEventNameInput.value,
            payload: this.socketPayloadTextarea.value,
            path: this.socketPathInput.value,
        };
    }

    saveState() {
        stateManager.saveSocketState(this.getCurrentState());
    }

    applyState(state) {
        this.socketUrlInput.value = state.url || "";
        this.socketTokenInput.value = state.token || "";
        this.socketUserIdInput.value = state.userId || "";
        this.socketEventNameInput.value = state.eventName || "message";
        this.socketPayloadTextarea.value = state.payload || "{}";
        this.socketPathInput.value = state.path || "/socket.io";
        this.saveState();
    }

    updateSocketUI(isConnected) {
        if (isConnected) {
            this.socketConnectButton.style.display = "none";
            this.socketDisconnectButton.style.display = "inline-block";
            this.socketEmitButton.disabled = false;
            this.socketListenButton.disabled = false;
            this.clearListenLogButton.disabled = false;
            this.socketUrlInput.disabled = true;
            this.socketPathInput.disabled = true;
            this.socketTokenInput.disabled = true;
            this.socketUserIdInput.disabled = true;
        } else {
            this.socketConnectButton.style.display = "inline-block";
            this.socketDisconnectButton.style.display = "none";
            this.socketEmitButton.disabled = true;
            this.socketListenButton.disabled = true;
            this.clearListenLogButton.disabled = true;
            this.socketUrlInput.disabled = false;
            this.socketPathInput.disabled = false;
            this.socketTokenInput.disabled = false;
            this.socketUserIdInput.disabled = false;
        }
    }

    updateSocketStatus(text, className) {
        this.socketStatusSpan.textContent = text;
        this.socketStatusSpan.className = `status-indicator ${className}`;
        const isConnected = className === "connected";
        this.updateSocketUI(isConnected);
    }

    addSocketLog(message, type) {
        const div = document.createElement("div");
        div.className = `log-entry log-${type}`;
        const time = new Date().toLocaleTimeString();
        div.innerHTML = `<span class="log-time">[${time}]</span>${message.replace(/\n/g, "<br>")}`;
        this.socketLogContainer.appendChild(div);
        this.socketLogContainer.scrollTop = this.socketLogContainer.scrollHeight;
    }

    addSocketListenLog(eventName, message) {
        const div = document.createElement("div");
        div.className = `log-entry log-info`;
        const time = new Date().toLocaleTimeString();
        div.innerHTML = `<span class="log-time">[${time}] [Event: ${eventName}]</span><br/>${message.replace(/\n/g, "<br>")}`;
        this.socketListenLogContainer.appendChild(div);
        this.socketListenLogContainer.scrollTop = this.socketListenLogContainer.scrollHeight;
    }
}
