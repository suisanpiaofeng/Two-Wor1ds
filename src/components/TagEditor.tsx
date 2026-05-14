import React, { useState } from 'react';
import type { Tag } from '../types';

interface TagEditorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onTagSelect: (tagId: string) => void;
  onTagDeselect: (tagId: string) => void;
  onAddTag: (name: string) => void;
}

export default function TagEditor({
  tags,
  selectedTagIds,
  onTagSelect,
  onTagDeselect,
  onAddTag,
}: TagEditorProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.some(t => t.name === trimmed)) {
      onAddTag(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagDeselect(tagId);
    } else {
      onTagSelect(tagId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`px-3 py-1.5 rounded-card text-sm btn-interaction ${
                isSelected
                  ? 'bg-primary-blue text-gray-text'
                  : 'bg-white border border-primary-blue/50 text-gray-text/70 hover:border-primary-blue'
              }`}
            >
              {tag.name}
              {tag.isPreset && <span className="ml-1 opacity-50"></span>}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加自定义标签..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-primary-blue/50 rounded-card focus:outline-none focus:border-primary-blue text-gray-text placeholder-gray-text/50"
        />
        <button
          onClick={handleAddTag}
          className="px-4 py-2 text-sm bg-primary-blue text-gray-text rounded-card btn-interaction hover:bg-primary-blue/80"
        >
          添加
        </button>
      </div>

      {selectedTagIds.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-text/60">
          <span>已选标签:</span>
          {selectedTagIds.map(id => {
            const tag = tags.find(t => t.id === id);
            return tag ? (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-blue/50 rounded text-gray-text"
              >
                {tag.name}
                <button
                  onClick={() => onTagDeselect(id)}
                  className="ml-1 hover:text-gray-text/80"
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}