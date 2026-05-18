import React, { useState } from 'react';
import { Collection } from '../types';
import { Folder, Save, Trash2, Download, Upload, Zap } from 'lucide-react';

interface SidebarProps {
  collections: Collection[];
  currentTab: 'http' | 'socket';
  selectedCollectionName: string;
  onSelectCollection: (name: string) => void;
  onSaveCollection: (name: string) => void;
  onDeleteCollection: (name: string) => void;
  onClearCollections: () => void;
  onImportJson: () => void;
  onExportJson: () => void;
  onDetectSwagger?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  currentTab,
  selectedCollectionName,
  onSelectCollection,
  onSaveCollection,
  onDeleteCollection,
  onClearCollections,
  onImportJson,
  onExportJson,
  onDetectSwagger,
}) => {
  const [newCollectionName, setNewCollectionName] = useState('');
  const filteredCollections = collections.filter((c) => c.type === currentTab);

  const handleSave = () => {
    if (!newCollectionName.trim()) {
      alert(`Por favor, introduce un nombre para la colección de ${currentTab.toUpperCase()}.`);
      return;
    }
    onSaveCollection(newCollectionName.trim());
    setNewCollectionName('');
  };

  return (
    <aside className="w-80 flex-shrink-0 p-5 bg-bgPanel border-2 border-borderDark rounded-none h-[calc(100vh-100px)] overflow-y-auto flex flex-col gap-6 shadow-retro-dark">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-5 text-accentLight border-b-2 border-borderDark pb-2">
          <Folder className="w-5 h-5" />
          COLECCIONES
        </h2>

        {/* Section Title */}
        <h3 className="text-sm font-bold uppercase tracking-wider text-textMuted mb-3">
          {currentTab === 'http' ? '&gt; HTTP REQUESTS' : '&gt; SOCKET.IO EVENTS'}
        </h3>

        {/* Save Form */}
        <div className="flex flex-col gap-2 mb-5">
          <label className="text-xs font-bold uppercase text-textMuted">
            Nombre de Colección
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="NUEVO NOMBRE"
              className="flex-grow p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none placeholder-textMuted"
            />
            <button
              onClick={handleSave}
              className="px-3 bg-textMain text-bgDark hover:bg-accentLight transition font-bold rounded-none flex items-center justify-center text-xs uppercase border-2 border-transparent hover:border-textMain"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Select & Action Form */}
        <div className="flex flex-col gap-2 mb-6">
          <label className="text-xs font-bold uppercase text-textMuted">
            Seleccionar
          </label>
          <select
            value={selectedCollectionName}
            onChange={(e) => onSelectCollection(e.target.value)}
            className="w-full p-2.5 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none uppercase"
          >
            <option value="">-- SELECCIONAR --</option>
            {filteredCollections.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onSelectCollection(selectedCollectionName)}
              disabled={!selectedCollectionName}
              className="flex-1 py-2 bg-textMain text-bgDark hover:bg-accentLight disabled:bg-borderDark disabled:text-textMuted transition font-bold rounded-none text-xs uppercase"
            >
              Cargar
            </button>
            <button
              onClick={() => onDeleteCollection(selectedCollectionName)}
              disabled={!selectedCollectionName}
              className="py-2 px-3 bg-bgDark text-textMain border-2 border-borderDark hover:border-textMain hover:bg-textMain hover:text-bgDark disabled:opacity-50 transition font-bold rounded-none text-xs uppercase flex items-center justify-center"
              title="Borrar seleccionada"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* JSON/Swagger Controls */}
      <div className="mt-auto border-t-2 border-borderDark pt-4 flex flex-col gap-3">
        <button
          onClick={onClearCollections}
          className="w-full py-2 bg-bgDark text-textMain border-2 border-borderDark hover:bg-textMain hover:text-bgDark transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2 mb-2"
        >
          <Trash2 className="w-4 h-4" />
          LIMPIAR COLECCIONES
        </button>

        <div className="flex gap-2">
          <button
            onClick={onImportJson}
            className="flex-1 py-2 bg-bgDark border-2 border-borderDark hover:border-textMain text-textMain transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            onClick={onExportJson}
            className="flex-1 py-2 bg-bgDark border-2 border-borderDark hover:border-textMain text-textMain transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>

        {currentTab === 'http' && onDetectSwagger && (
          <button
            onClick={onDetectSwagger}
            className="w-full py-2 bg-textMain text-bgDark font-bold rounded-none text-xs uppercase flex items-center justify-center gap-1.5 transition hover:bg-accentLight"
          >
            <Zap className="w-4 h-4" />
            IMPORTAR SWAGGER
          </button>
        )}
      </div>
    </aside>
  );
};
