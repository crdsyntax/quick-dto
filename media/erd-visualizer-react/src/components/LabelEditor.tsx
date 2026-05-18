import React, { useEffect, useRef } from 'react';

interface LabelEditorProps {
  x: number;
  y: number;
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
}

const LabelEditor: React.FC<LabelEditorProps> = ({ x, y, value, onSave, onCancel }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(inputRef.current?.value || '');
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="absolute z-[2000]" 
      style={{ left: x, top: y }}
    >
      <input
        ref={inputRef}
        type="text"
        className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] p-[2px_4px] text-[11px] outline-none"
        defaultValue={value}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(inputRef.current?.value || '')}
      />
    </div>
  );
};

export default LabelEditor;
