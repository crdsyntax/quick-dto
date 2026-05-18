import { vscodeApi } from './vscodeApi.js';

class StateManager {
    constructor() {
        if (!StateManager.instance) {
            this.collections = [];
            this.currentTab = "http";
            StateManager.instance = this;
        }
        return StateManager.instance;
    }

    init() {
        const savedState = vscodeApi.getState();
        if (savedState && savedState.collections) {
            this.collections = savedState.collections;
        }
        return savedState || {};
    }

    getCollections(type) {
        return type ? this.collections.filter(c => c.type === type) : this.collections;
    }

    addOrUpdateCollection(newCollection) {
        const index = this.collections.findIndex(c => c.name === newCollection.name && c.type === newCollection.type);
        if (index !== -1) {
            this.collections[index] = newCollection;
        } else {
            this.collections.push(newCollection);
        }
        this.saveCollectionsState();
    }

    removeCollection(name, type) {
        this.collections = this.collections.filter(c => !(c.name === name && c.type === type));
        this.saveCollectionsState();
    }
    
    setCollections(newCollections) {
        this.collections = newCollections;
        this.saveCollectionsState();
    }

    saveCollectionsState() {
        vscodeApi.setState({
            ...vscodeApi.getState(),
            collections: this.collections,
        });

        vscodeApi.postMessage({
            command: "saveCollections",
            collections: this.collections,
        });
    }

    saveHttpRequestState(httpState) {
        vscodeApi.setState({
            ...vscodeApi.getState(),
            ...httpState,
            collections: this.collections,
        });

        vscodeApi.postMessage({
            command: "saveLastRequest",
            request: httpState
        });
    }

    saveSocketState(socketState) {
        vscodeApi.postMessage({
            command: "socketStateUpdate",
            data: socketState,
        });
    }
}

export const stateManager = new StateManager();
