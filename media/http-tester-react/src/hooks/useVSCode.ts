import { useCallback } from 'react';

// Setup VSCode API type
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage(message: any): void;
      getState(): any;
      setState(state: any): void;
    };
  }
}

let vscode: any = null;
try {
  if (typeof window !== 'undefined' && window.acquireVsCodeApi) {
    vscode = window.acquireVsCodeApi();
  } else {
    vscode = {
      postMessage: (msg: any) => console.log('VSCode PostMessage (Fallback):', msg),
      getState: () => ({}),
      setState: (state: any) => console.log('VSCode SetState (Fallback):', state),
    };
  }
} catch (e) {
  vscode = {
    postMessage: (msg: any) => console.log('VSCode PostMessage (Fallback):', msg),
    getState: () => ({}),
    setState: (state: any) => console.log('VSCode SetState (Fallback):', state),
  };
}

export function useVSCode() {
  const postMessage = useCallback((command: string, data?: any) => {
    const panelId = typeof window !== 'undefined' ? (window as any).vscodePanelId : undefined;
    vscode.postMessage({ command, panelId, ...data });
  }, []);

  const getState = useCallback(() => {
    return vscode.getState() || {};
  }, []);

  const setState = useCallback((state: any) => {
    vscode.setState(state);
  }, []);

  return { postMessage, getState, setState };
}
