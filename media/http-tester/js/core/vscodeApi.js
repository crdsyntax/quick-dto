// @ts-nocheck
class VSCodeAPI {
    constructor() {
        if (!VSCodeAPI.instance) {
            this.vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
            this.listeners = [];

            window.addEventListener("message", (event) => {
                this.listeners.forEach(listener => listener(event.data));
            });

            VSCodeAPI.instance = this;
        }
        return VSCodeAPI.instance;
    }

    postMessage(message) {
        if (this.vscode) {
            this.vscode.postMessage(message);
        } else {
            console.log("VSCode API not available. Message:", message);
        }
    }

    getState() {
        return this.vscode ? this.vscode.getState() : {};
    }

    setState(state) {
        if (this.vscode) {
            this.vscode.setState(state);
        }
    }

    onMessage(callback) {
        this.listeners.push(callback);
    }
}

export const vscodeApi = new VSCodeAPI();
