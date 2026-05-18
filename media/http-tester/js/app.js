import { vscodeApi } from './core/vscodeApi.js';
import { stateManager } from './core/stateManager.js';
import { uiUtils } from './ui/domUtils.js';
import { HttpModule } from './modules/httpModule.js';
import { SocketModule } from './modules/socketModule.js';
import { CollectionModule } from './modules/collectionModule.js';

class App {
    constructor() {
        this.httpModule = new HttpModule();
        this.socketModule = new SocketModule();
        this.collectionModule = new CollectionModule(this.httpModule, this.socketModule);
        
        this.currentTab = "http";
        this.init();
    }

    init() {
        // Init UI
        this.setupSidebarToggle();
        this.setupTabs();

        // Restore State
        const savedState = stateManager.init();
        if (savedState) {
            this.httpModule.applyState(savedState);
            this.collectionModule.updateCollectionSelect(this.currentTab);
        }

        // Handle Messages from VSCode
        vscodeApi.onMessage((message) => this.handleMessage(message));

        // Add default row if empty
        if (this.httpModule.paramsContainer.children.length === 0) {
            this.httpModule.addRow(this.httpModule.paramsContainer, "param");
        }
    }

    setupSidebarToggle() {
        const toggleSidebarButton = document.getElementById("toggle-sidebar-button");
        const collectionsSidebar = document.getElementById("collections-sidebar");
        const mainContent = document.querySelector(".main-content");

        toggleSidebarButton.addEventListener("click", () => {
            if (collectionsSidebar.style.display === "none") {
                collectionsSidebar.style.display = "block";
                mainContent.style.maxWidth = "calc(100% - 350px)";
                toggleSidebarButton.textContent = "Ocultar Panel de Colección";
            } else {
                collectionsSidebar.style.display = "none";
                mainContent.style.maxWidth = "100%";
                toggleSidebarButton.textContent = "Mostrar Panel de Colección";
            }
        });
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll(".tab-button");
        const tabContents = document.querySelectorAll(".tab-content");

        tabButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const targetTab = button.getAttribute("data-tab");

                tabButtons.forEach((btn) => btn.classList.remove("active"));
                button.classList.add("active");

                tabContents.forEach((content) => {
                    if (content.id === `${targetTab}-tab`) {
                        content.classList.add("active");
                    } else {
                        content.classList.remove("active");
                    }
                });

                document.getElementById("http-collection-controls").style.display = targetTab === "http" ? "block" : "none";
                document.getElementById("socket-collection-controls").style.display = targetTab === "socket" ? "block" : "none";

                this.currentTab = targetTab;
                this.collectionModule.updateCollectionSelect(this.currentTab);

                if (targetTab === "socket") {
                    vscodeApi.postMessage({ command: "socketGetInitialState" });
                }
            });
        });
    }

    handleMessage(message) {
        switch (message.command) {
            case "response":
                uiUtils.stopLoading();
                uiUtils.displayResponse(message.response);
                break;
            case "error":
                uiUtils.stopLoading();
                uiUtils.showError(message.message);
                break;
            case "repeatProgress":
                uiUtils.displayResponse(message.response);
                uiUtils.responseHeader.innerHTML += ` <span style="color: #8b5cf6;">[${message.current}/${message.total}]</span>`;
                break;
            case "repeatComplete":
                uiUtils.stopLoading();
                const successCount = message.results.filter(r => r.success).length;
                const failCount = message.results.filter(r => !r.success).length;
                const summaryHtml = `
                    <div style="padding: 15px; background: #1e293b; border-radius: 6px; margin-top: 15px;">
                        <h3 style="color: #38bdf8; margin-bottom: 10px;">Repeat Request Summary</h3>
                        <p style="color: #10b981;">✓ Successful: ${successCount}</p>
                        <p style="color: #ef4444;">✗ Failed: ${failCount}</p>
                        <p style="color: #94a3b8;">Total: ${message.totalRequests}</p>
                    </div>
                `;
                uiUtils.responseData.innerHTML += summaryHtml;
                break;
            case "stopLoading":
                uiUtils.stopLoading();
                break;
            case "socketLog":
                this.socketModule.addSocketLog(message.message, message.type);
                break;
            case "socketListenLog":
                this.socketModule.addSocketListenLog(message.eventName, message.message);
                break;
            case "socketStatus":
                this.socketModule.updateSocketStatus(message.status, message.className);
                break;
            case "loadCollections":
                if (message.collections && Array.isArray(message.collections)) {
                    const newHttpCollections = message.collections.filter(c => c.type === "http");
                    const oldSocketCollections = stateManager.getCollections("socket");
                    stateManager.setCollections([...oldSocketCollections, ...newHttpCollections]);
                    
                    this.collectionModule.updateCollectionSelect(this.currentTab);

                    const firstHttpCollection = newHttpCollections[0];
                    if (firstHttpCollection) {
                        this.collectionModule.httpCollectionSelect.value = firstHttpCollection.name;
                        this.collectionModule.httpCollectionSelect.dispatchEvent(new Event("change"));
                        this.collectionModule.handleLoadCollection("http");
                    }
                }
                break;
            case "socketInitialState":
                this.socketModule.applyState(message.state);
                this.socketModule.updateSocketStatus(message.status.text, message.status.class);
                break;
            case "importedCollections":
                if (message.collections && Array.isArray(message.collections)) {
                    message.collections.forEach(importedCol => {
                        stateManager.addOrUpdateCollection(importedCol);
                    });
                    this.collectionModule.updateCollectionSelect(this.currentTab);
                    alert(`✅ ${message.collections.length} colección(es) importada(s) exitosamente.`);
                }
                break;
            case "initializeCollections":
                if (message.collections && Array.isArray(message.collections)) {
                    stateManager.collections = message.collections;
                    this.collectionModule.updateCollectionSelect(this.currentTab);

                    if (message.lastRequest) {
                        this.httpModule.applyState(message.lastRequest);
                    }
                    
                    vscodeApi.setState({
                        ...vscodeApi.getState(),
                        collections: stateManager.collections,
                        ...(message.lastRequest || {})
                    });
                }
                break;
            case "loadRequest":
                if (message.request) {
                    const httpTab = document.querySelector('.tab-button[data-tab="http"]');
                    if (httpTab) httpTab.click();

                    this.httpModule.applyState(message.request);
                    this.httpModule.sendRequest();
                }
                break;
            case "loadCollection":
                if (message.collection) {
                    if (message.collection.type === "http") {
                        this.httpModule.applyState(message.collection);
                    } else {
                        this.socketModule.applyState(message.collection);
                    }

                    const targetTab = document.querySelector(`.tab-button[data-tab="${message.collection.type}"]`);
                    if (targetTab) targetTab.click();
                }
                break;
        }
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
