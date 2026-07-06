import React, { useState } from 'react';
import { Terminal, Send, Import, Download } from 'lucide-react';
import { parseCurl } from '../utils/curlParser';

interface CurlPanelProps {
  onImport: (request: any, autoRun: boolean) => void;
  onExportJson?: (payload: unknown) => void;
}

export const CurlPanel: React.FC<CurlPanelProps> = ({ onImport, onExportJson }) => {
  const [curlCommand, setCurlCommand] = useState('');
  const [error, setError] = useState('');

  const handleAction = (autoRun: boolean) => {
    setError('');
    if (!curlCommand.trim()) {
      setError('Please enter a curl command.');
      return;
    }

    try {
      const parsedRequest = parseCurl(curlCommand);
      if (!parsedRequest.url) {
        setError('Could not detect a valid URL in the command.');
        return;
      }
      onImport(parsedRequest, autoRun);
    } catch (e: any) {
      setError(`Error parsing curl: ${e.message}`);
    }
  };

  const handleExport = () => {
    setError('');

    if (!curlCommand.trim()) {
      setError('Please enter a curl command.');
      return;
    }

    try {
      const parsed = parseCurl(curlCommand);
      if (!parsed.url) {
        setError('Could not detect a valid URL in the command.');
        return;
      }
      onExportJson?.(parsed);
    } catch (e: any) {
      setError(`Error parsing curl: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto min-h-[400px]">
      <div className="bg-bgPanel/30 border border-borderDark rounded-lg p-4 flex flex-col gap-3 shadow-card">
        <div className="flex items-center gap-2 text-xs font-medium text-textMuted pb-2 border-b border-borderDark">
          <Terminal className="w-4 h-4" />
          <span>Paste curl command</span>
        </div>

        <textarea
          value={curlCommand}
          onChange={(e) => setCurlCommand(e.target.value)}
          placeholder={'curl -X POST http://api.example.com/data -H "Content-Type: application/json" -d \'{"key": "value"}\''}
          className="w-full min-h-[220px] px-3 py-2.5 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain font-mono focus:border-textMuted transition-colors resize-none placeholder:text-textMuted/50"
        />

        {error && (
          <p className="text-xs font-medium text-textMain">
            Error: {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => handleAction(false)}
            className="py-2 px-4 bg-bgDark border border-borderDark text-textMuted hover:border-textMuted hover:text-textMain transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-2"
          >
            <Import className="w-3.5 h-3.5" />
            Import to form
          </button>

          <button
            onClick={() => handleAction(true)}
            className="py-2 px-4 bg-bgDark border border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            Import & execute
          </button>

          <button
            onClick={handleExport}
            className="py-2 px-4 bg-bgDark border border-borderDark text-textMain hover:border-textMuted hover:text-textMain transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>

        <div className="mt-1 p-3 border-l-2 border-borderDark bg-bgDark/30 rounded-r-lg text-xs text-textMuted leading-relaxed">
          <p className="font-medium mb-1">Tip:</p>
          <p>Copy curl commands directly from your browser's developer tools (Network tab → Copy as cURL).</p>
        </div>
      </div>
    </div>
  );
};
