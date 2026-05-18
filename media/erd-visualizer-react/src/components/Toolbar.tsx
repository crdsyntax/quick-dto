import React from 'react';

interface ToolbarProps {
  onReset: () => void;
  onExport: () => void;
  onCopyMarkdown: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onReset, onExport, onCopyMarkdown }) => {
  return (
    <div className="absolute top-[10px] right-[10px] z-[1000] flex gap-2">
      <button 
        onClick={onReset}
        className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border border-transparent hover:bg-[var(--vscode-button-hoverBackground)] px-3 py-1.5 rounded-sm text-xs font-sans"
      >
        Reset Layout
      </button>
      <button 
        onClick={onExport}
        className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border border-transparent hover:bg-[var(--vscode-button-hoverBackground)] px-3 py-1.5 rounded-sm text-xs font-sans"
      >
        Export SVG
      </button>
      <button 
        onClick={onCopyMarkdown}
        className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border border-transparent hover:bg-[var(--vscode-button-hoverBackground)] px-3 py-1.5 rounded-sm text-xs font-sans"
      >
        Copy Markdown
      </button>
    </div>
  );
};

export default Toolbar;
