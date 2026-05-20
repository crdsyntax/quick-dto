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
    <div className="flex flex-col gap-5 w-full max-w-4xl mx-auto min-h-[450px]">
      <div className="bg-bgPanel p-5 border-2 border-borderDark rounded-none flex flex-col gap-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-textMuted border-b-2 border-borderDark pb-2 flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" />
          <span>&gt; PASTE CURL COMMAND</span>
        </h2>

        <div className="flex flex-col gap-2 flex-grow">
          <textarea
            value={curlCommand}
            onChange={(e) => setCurlCommand(e.target.value)}
            placeholder={'curl -X POST http://api.example.com/data -H "Content-Type: application/json" -d \'{"key": "value"}\''}
            className="w-full min-h-[250px] p-3.5 bg-bgDark border-2 border-borderDark text-accentLight font-mono text-xs focus:border-textMain focus:outline-none resize-none selection:bg-textMain selection:text-bgDark"
          />
          
          {error && (
            <p className="text-accentLight text-[10px] font-bold uppercase">
              [!] ERROR: {error}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
          <button
            onClick={() => handleAction(false)}
            className="py-2.5 px-5 bg-bgDark border-2 border-borderDark text-textMuted hover:border-textMain hover:text-textMain transition font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-2"
          >
            <Import className="w-3.5 h-3.5" />
            IMPORTAR A FORMULARIO
          </button>
          
          <button
            onClick={() => handleAction(true)}
            className="py-2.5 px-5 bg-bgDark border-2 border-textMain text-textMain hover:bg-textMain hover:text-bgDark transition font-bold rounded-none text-[10px] uppercase flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            IMPORTAR Y EJECUTAR
          </button>
        </div>

        <div className="mt-3 p-3 border-l-2 border-borderDark bg-bgDark/50 text-[10px] text-textMuted leading-relaxed">
          <p className="font-bold mb-1 uppercase opacity-80">Sugerencia:</p>
          <p>Puedes copiar comandos cURL directamente desde las herramientas de desarrollador de tu navegador.</p>
        </div>
      </div>
    </div>
  );
};
