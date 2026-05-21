import React from 'react';
import { Globe } from 'lucide-react';

interface CollectionPanelProps {
  name: string;
  group: string;
  onNameChange: (name: string) => void;
  onGroupChange: (group: string) => void;
  onSave: () => void;
}

export const CollectionPanel: React.FC<CollectionPanelProps> = ({
  name,
  group,
  onNameChange,
  onGroupChange,
  onSave,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-bgPanel/20 backdrop-blur-md p-3.5 border-2 border-borderDark rounded-none">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase text-textMuted">COLLECTION NAME</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Get Users List"
          className="p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold uppercase text-textMuted">GROUP NAME</label>
        <input
          type="text"
          value={group}
          onChange={(e) => onGroupChange(e.target.value)}
          placeholder="e.g. User Management"
          className="p-2 bg-bgDark border-2 border-borderDark text-textMain rounded-none text-sm focus:border-accentLight focus:outline-none"
        />
      </div>
      <button
        onClick={onSave}
        className="w-full h-[40px] bg-bgDark border-2 border-accentLight text-accentLight hover:bg-accentLight hover:text-bgDark transition font-bold rounded-none text-xs uppercase flex items-center justify-center gap-2"
      >
        <Globe className="w-4 h-4" />
        SAVE TO COLLECTION
      </button>
    </div>
  );
};
