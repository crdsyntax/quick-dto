export enum AppTab {
  HTTP = 'http',
  SOCKET = 'socket',
  METRICS = 'metrics',
  CURL = 'curl',
}

export enum SocketLogType {
  EVENT = 'event',
  ERROR = 'error',
  INFO = 'info',
}

export enum SocketStatusText {
  DISCONNECTED = 'Disconnected',
  CONNECTED = 'Connected',
  ERROR = 'Error',
}

export enum AuthType {
  NONE = 'none',
  BEARER = 'bearer',
  BASIC = 'basic',
  GLOBAL = 'global',
}

export enum SocketStatusClass {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export enum VscodePostCommand {
  SAVE_GLOBAL_TOKEN = 'saveGlobalToken',
  SAVE_GLOBAL_REFRESH_TOKEN = 'saveGlobalRefreshToken',
  SAVE_LAST_REQUEST = 'saveLastRequest',
  SOCKET_STATE_UPDATE = 'socketStateUpdate',
  REPEAT_REQUEST = 'repeatRequest',
  SEND_REQUEST = 'sendRequest',
  STOP_REPEATED_REQUESTS = 'stopRepeatedRequests',
  SOCKET_CONNECT = 'socketConnect',
  SOCKET_DISCONNECT = 'socketDisconnect',
  SOCKET_EMIT = 'socketEmit',
  SOCKET_LISTEN = 'socketListen',
  SHOW_TOAST = 'showToast',
  SAVE_COLLECTION = 'saveCollection',
  SAVE_COLLECTIONS = 'saveCollections',
  SOCKET_GET_INITIAL_STATE = 'socketGetInitialState',
}

export enum VscodeIncomingCommand {
  RESPONSE = 'response',
  ERROR = 'error',
  REPEAT_PROGRESS = 'repeatProgress',
  REPEAT_COMPLETE = 'repeatComplete',
  STOP_LOADING = 'stopLoading',
  SOCKET_LOG = 'socketLog',
  SOCKET_LISTEN_LOG = 'socketListenLog',
  SOCKET_STATUS = 'socketStatus',
  LOAD_COLLECTIONS = 'loadCollections',
  SOCKET_INITIAL_STATE = 'socketInitialState',
  LOAD_GLOBAL_TOKEN = 'loadGlobalToken',
  LOAD_GLOBAL_REFRESH_TOKEN = 'loadGlobalRefreshToken',
  IMPORTED_COLLECTIONS = 'importedCollections',
  INITIALIZE_COLLECTIONS = 'initializeCollections',
  LOAD_REQUEST = 'loadRequest',
  LOAD_COLLECTION = 'loadCollection',
}
