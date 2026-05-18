import { vscodeApi } from '../core/vscodeApi.js';
import { stateManager } from '../core/stateManager.js';

export class CollectionModule {
    constructor(httpModule, socketModule) {
        this.httpModule = httpModule;
        this.socketModule = socketModule;

        this.httpCollectionControls = document.getElementById("http-collection-controls");
        this.httpCollectionNameInput = document.getElementById("http-collection-name");
        this.httpCollectionSelect = document.getElementById("http-collection-select");
        this.httpSaveCollectionButton = document.getElementById("http-save-collection-button");
        this.httpLoadCollectionButton = document.getElementById("http-load-collection-button");
        this.httpDeleteCollectionButton = document.getElementById("http-delete-collection-button");

        this.socketCollectionControls = document.getElementById("socket-collection-controls");
        this.socketCollectionNameInput = document.getElementById("socket-collection-name");
        this.socketCollectionSelect = document.getElementById("socket-collection-select");
        this.socketSaveCollectionButton = document.getElementById("socket-save-collection-button");
        this.socketLoadCollectionButton = document.getElementById("socket-load-collection-button");
        this.socketDeleteCollectionButton = document.getElementById("socket-delete-collection-button");

        this.initEventListeners();
    }

    initEventListeners() {
        this.httpSaveCollectionButton.addEventListener("click", () => this.handleSaveCollection("http"));
        this.httpLoadCollectionButton.addEventListener("click", () => this.handleLoadCollection("http"));
        this.httpDeleteCollectionButton.addEventListener("click", () => this.handleDeleteCollection("http"));

        this.socketSaveCollectionButton.addEventListener("click", () => this.handleSaveCollection("socket"));
        this.socketLoadCollectionButton.addEventListener("click", () => this.handleLoadCollection("socket"));
        this.socketDeleteCollectionButton.addEventListener("click", () => this.handleDeleteCollection("socket"));

        // Import/Export
        document.getElementById("http-import-json-button").addEventListener("click", () => this.handleImportJson("http"));
        document.getElementById("socket-import-json-button").addEventListener("click", () => this.handleImportJson("socket"));
        document.getElementById("http-export-json-button").addEventListener("click", () => this.handleExportJson("http"));
        document.getElementById("socket-export-json-button").addEventListener("click", () => this.handleExportJson("socket"));
        document.getElementById("http-import-swagger-button").addEventListener("click", () => {
            vscodeApi.postMessage({ command: "detectSwagger" });
            document.getElementById("loading-overlay").classList.add("active");
        });
    }

    updateCollectionSelect(currentTab) {
        const selector = currentTab === "http" ? this.httpCollectionSelect : this.socketCollectionSelect;
        const currentTabCollections = stateManager.getCollections(currentTab);

        selector.innerHTML = '<option value="">-- Selecciona una Colección --</option>';
        currentTabCollections.forEach((col) => {
            const option = document.createElement("option");
            option.value = col.name;
            option.textContent = col.name;
            selector.appendChild(option);
        });

        const loadButton = currentTab === "http" ? this.httpLoadCollectionButton : this.socketLoadCollectionButton;
        const deleteButton = currentTab === "http" ? this.httpDeleteCollectionButton : this.socketDeleteCollectionButton;

        const hasSelection = selector.value !== "";
        loadButton.disabled = !hasSelection;
        deleteButton.disabled = !hasSelection;

        selector.onchange = () => {
            const selected = selector.value !== "";
            loadButton.disabled = !selected;
            deleteButton.disabled = !selected;
        };
    }

    handleSaveCollection(type) {
        const nameInput = type === "http" ? this.httpCollectionNameInput : this.socketCollectionNameInput;
        const name = nameInput.value.trim();

        if (!name) {
            alert(`Por favor, introduce un nombre para la colección de ${type.toUpperCase()}.`);
            return;
        }

        const currentState = type === "http" ? this.httpModule.getCurrentState() : this.socketModule.getCurrentState();
        const newCollection = {
            name: name,
            ...currentState,
        };

        stateManager.addOrUpdateCollection(newCollection);
        alert(`Colección '${name}' (${type.toUpperCase()}) guardada/actualizada.`);
        
        this.updateCollectionSelect(type);
        nameInput.value = "";
    }

    handleLoadCollection(type) {
        const select = type === "http" ? this.httpCollectionSelect : this.socketCollectionSelect;
        const name = select.value;
        const collection = stateManager.getCollections().find(c => c.name === name && c.type === type);

        if (collection) {
            if (type === "http") {
                this.httpModule.applyState(collection);
            } else {
                this.socketModule.applyState(collection);
            }
            alert(`Colección '${name}' (${type.toUpperCase()}) cargada.`);
        }
    }

    handleDeleteCollection(type) {
        const select = type === "http" ? this.httpCollectionSelect : this.socketCollectionSelect;
        const name = select.value;

        if (!name) {
            alert("Por favor, selecciona una colección para eliminar.");
            return;
        }

        if (confirm(`¿Estás seguro de que deseas eliminar la colección '${name}' (${type.toUpperCase()})?`)) {
            vscodeApi.postMessage({
                command: "deleteCollection",
                name: name,
                type: type
            });
            alert(`Solicitud de eliminación para '${name}' enviada.`);
        }
    }

    handleImportJson(type) {
        vscodeApi.postMessage({
            command: "importJson",
            type: type,
        });
    }

    handleExportJson(type) {
        vscodeApi.postMessage({
            command: "exportJson",
            type: type,
            collections: stateManager.collections,
        });
    }
}
