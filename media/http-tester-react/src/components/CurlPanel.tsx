import React, { useState } from 'react';
import { Terminal, Send, Import } from 'lucide-react';
import { parseCurl } from '../utils/curlParser';

interface CurlPanelProps {
  onImport: (request: any, autoRun: boolean) => void;
}

export const CurlPanel: React.FC<CurlPanelProps> = ({ onImport }) => {
  const [curlCommand, setCurlCommand] = useState('');
  const [error, setError] = useState('');

  const handleAction = (autoRun: boolean) => {
    setError('');
    if (!curlCommand.trim()) {
      setError('POR FAVOR INGRESA UN COMANDO CURL.');
      return;
    }

    try {
      const parsedRequest = parseCurl(curlCommand);
      if (!parsedRequest.url) {
        setError('NO SE PUDO DETECTAR UNA URL VÁLIDA EN EL COMANDO.');
        return;
      }
      onImport(parsedRequest, autoRun);
    } catch (e: any) {
      setError(`ERROR AL PARSEAR CURL: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto min-h-[500px]">
      <div className="bg-bgPanel p-6 border-2 border-borderDark rounded-none flex flex-col gap-4 shadow-retro-dark">
        <h2 className="text-sm font-bold uppercase tracking-wider text-textMuted border-b-2 border-borderDark pb-2 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>&gt; PASTE CURL COMMAND</span>
        </h2>

        <div className="flex flex-col gap-2 flex-grow">
          <textarea
            value={curlCommand}
            onChange={(e) => setCurlCommand(e.target.value)}
            placeholder={'curl -X POST http://api.example.com/data -H "Content-Type: application/json" -d \'{"key": "value"}\''}
            className="w-full min-h-[300px] p-4 bg-bgDark border-2 border-borderDark text-accentLight font-mono text-sm focus:border-textMain focus:outline-none resize-none selection:bg-textMain selection:text-bgDark"
          />
          
          {error && (
            <p className="text-accentLight text-xs font-bold uppercase animate-pulse">
              [!] ERROR: {error}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <button
            onClick={() => handleAction(false)}
            className="py-3 px-6 bg-bgDark border-2 border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2"
          >
            <Import className="w-4 h-4" />
            IMPORTAR A FORMULARIO HTTP
          </button>
          
          <button
            onClick={() => handleAction(true)}
            className="py-3 px-6 bg-textMain text-bgDark hover:bg-accentLight transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            IMPORTAR Y EJECUTAR
          </button>
        </div>

        <div className="mt-4 p-4 border-l-4 border-borderDark bg-bgDark/50 text-[11px] text-textMuted leading-relaxed">
          <p className="font-bold mb-1 uppercase">Sugerencia:</p>
          <p>Puedes copiar comandos cURL directamente desde las herramientas de desarrollador de tu navegador (Network tab - Right click - Copy as cURL).</p>
        </div>
      </div>
    </div>
  );
};
