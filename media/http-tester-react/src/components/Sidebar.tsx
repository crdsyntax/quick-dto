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
      alert(`Please enter a name for the ${currentTab.toUpperCase()} collection.`);
      return;
    }
    onSaveCollection(newCollectionName.trim());
    setNewCollectionName('');
  };

  return (
    <aside className="w-80 flex-shrink-0 p-4 bg-bgPanel/40 border border-borderDark rounded-lg h-[calc(100vh-100px)] overflow-y-auto flex flex-col gap-5 shadow-card">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4 text-textMain pb-2 border-b border-borderDark">
          <Folder className="w-4 h-4" />
          Collections
        </h2>

        <p className="text-xs font-medium text-textMuted mb-3">
          {currentTab === 'http' ? 'HTTP requests' : 'Socket.IO events'}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <label className="text-[11px] font-medium text-textMuted">Collection name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="New name"
              className="flex-1 px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors placeholder:text-textMuted/50"
            />
            <button
              onClick={handleSave}
              className="px-3 bg-textMain text-bgDark hover:bg-accentLight transition-colors rounded-lg flex items-center justify-center text-xs font-semibold border border-transparent"
              title="Save collection"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <label className="text-[11px] font-medium text-textMuted">Select</label>
          <select
            value={selectedCollectionName}
            onChange={(e) => onSelectCollection(e.target.value)}
            className="w-full px-3 py-2 bg-bgDark border border-borderDark rounded-lg text-sm text-textMain focus:border-textMuted transition-colors"
          >
            <option value="">-- Select --</option>
            {filteredCollections.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onSelectCollection(selectedCollectionName)}
              disabled={!selectedCollectionName}
              className="flex-1 py-1.5 bg-textMain text-bgDark hover:bg-accentLight disabled:bg-borderDark disabled:text-textMuted transition-colors rounded-lg text-xs font-semibold"
            >
              Load
            </button>
            <button
              onClick={() => onDeleteCollection(selectedCollectionName)}
              disabled={!selectedCollectionName}
              className="py-1.5 px-3 bg-bgDark text-textMain border border-borderDark hover:border-textMuted disabled:opacity-40 transition-colors rounded-lg text-xs font-medium flex items-center justify-center"
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-borderDark pt-4 flex flex-col gap-3">
        <button
          onClick={onClearCollections}
          className="w-full py-1.5 bg-bgDark text-textMain border border-borderDark hover:border-textMuted transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear collections
        </button>

        <div className="flex gap-2">
          <button
            onClick={onImportJson}
            className="flex-1 py-1.5 bg-bgDark border border-borderDark hover:border-textMuted text-textMain transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Import JSON
          </button>
          <button
            onClick={onExportJson}
            className="flex-1 py-1.5 bg-bgDark border border-borderDark hover:border-textMuted text-textMain transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>

        {currentTab === 'http' && onDetectSwagger && (
          <button
            onClick={onDetectSwagger}
            className="w-full py-1.5 bg-textMain text-bgDark hover:bg-accentLight transition-colors rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-card"
          >
            <Zap className="w-4 h-4" />
            Import Swagger
          </button>
        )}
      </div>
    </aside>
  );
};
