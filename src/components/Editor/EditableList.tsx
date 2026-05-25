/** Editable list component - each item is a text input, + add button at bottom */
import { useId, useRef, useState, type KeyboardEvent } from 'react';

interface EditableListProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  /** When provided, an auto-fill button appears next to the label */
  onSuggest?: () => void;
  collapsibleSelectedItems?: boolean;
}

export function EditableList({
  label,
  items,
  onChange,
  placeholder = `Add item${String.fromCharCode(8230)}`,
  addLabel = '+ Add',
  onSuggest,
  collapsibleSelectedItems = false,
}: EditableListProps) {
  const [newItem, setNewItem] = useState('');
  const [selectedItemsOpen, setSelectedItemsOpen] = useState(false);
  const selectedItemsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleBlur = (index: number, value: string) => {
    if (!value.trim()) {
      handleRemove(index);
    }
  };

  const renderItemRows = () => items.map((item, index) => (
    <div key={index} className="list-item">
      <input
        className="field-input"
        type="text"
        value={item}
        onChange={(e) => handleChange(index, e.target.value)}
        onBlur={(e) => handleBlur(index, e.target.value)}
      />
      <button
        className="list-item-remove"
        onClick={() => handleRemove(index)}
        type="button"
        aria-label="Remove item"
      >
        {String.fromCharCode(215)}
      </button>
    </div>
  ));

  const selectedCountLabel =
    items.length === 1 ? '1 file selected' : `${items.length} files selected`;

  return (
    <div className="field-group">
      <div className="editable-field__header">
        <div className="field-label">{label}</div>
        {onSuggest && (
          <button
            type="button"
            className="suggest-btn"
            onClick={onSuggest}
            title="Auto-fill"
          >
            {String.fromCodePoint(0x2728)} Auto-fill
          </button>
        )}
      </div>
      <div className={`editable-list${collapsibleSelectedItems ? ' editable-list--collapsible' : ''}`}>
        {collapsibleSelectedItems && (
          <div className="editable-list__selected-summary">
            <span>{selectedCountLabel}</span>
            <button
              type="button"
              className="editable-list__selected-toggle"
              onClick={() => setSelectedItemsOpen((open) => !open)}
              aria-expanded={selectedItemsOpen}
              aria-controls={selectedItemsId}
              disabled={items.length === 0}
            >
              {selectedItemsOpen ? 'Hide selected files ▴' : 'Show selected files ▾'}
            </button>
          </div>
        )}

        {!collapsibleSelectedItems && renderItemRows()}

        {collapsibleSelectedItems && selectedItemsOpen && (
          <div
            id={selectedItemsId}
            className="editable-list__selected-panel"
            aria-label={`${label} selected files`}
          >
            {renderItemRows()}
          </div>
        )}

        <div className="list-item list-item--add">
          <input
            ref={inputRef}
            className="field-input"
            type="text"
            placeholder={placeholder}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="list-item-add-btn"
            onClick={handleAdd}
            type="button"
            disabled={!newItem.trim()}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditableList;
