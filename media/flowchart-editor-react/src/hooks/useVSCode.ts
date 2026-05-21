import { useState, useCallback, useEffect } from 'react';

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

let vscode: any = null;
try {
  vscode = acquireVsCodeApi();
} catch (e) {
  // Not in VS Code webview
}

export const useVSCode = () => {
  const postMessage = useCallback((type: string, data?: any) => {
    if (vscode) {
      vscode.postMessage({ type, ...data });
    }
  }, []);

  const getState = useCallback(() => {
    return vscode ? vscode.getState() : null;
  }, []);

  const setState = useCallback((state: any) => {
    if (vscode) {
      vscode.setState(state);
    }
  }, []);

  return { postMessage, getState, setState };
};
