import React from 'react';

const LoadingOverlay: React.FC = () => {
  return (
    <div id="loading-overlay" className="absolute inset-0 bg-[var(--vscode-editor-background)] flex flex-col items-center justify-center z-[5000] transition-opacity duration-300">
      <div className="spinner w-10 h-10 border-4 border-[var(--vscode-progressBar-background)] border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="loading-text text-sm text-[var(--vscode-descriptionForeground)]">Processing ERD...</div>
    </div>
  );
};

export default LoadingOverlay;
