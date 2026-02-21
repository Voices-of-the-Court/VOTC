import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ActionCommandInput.scss';

// Types for action data
interface ActionArg {
  name: string;
  type: 'number' | 'string' | 'enum' | 'boolean';
  description: string;
  displayName?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  minLength?: number;
  options?: string[];
}

interface ActionDetails {
  valid: boolean;
  error?: string;
  canExecute?: boolean;
  id?: string;
  title?: string;
  args?: ActionArg[];
  requiresTarget?: boolean;
  validTargetCharacterIds?: number[];
  isDestructive?: boolean;
}

interface Character {
  id: number;
  fullName: string;
  shortName: string;
}

interface ActionSummary {
  id: string;
  title: string;
  scope: 'standard' | 'custom';
  disabled: boolean;
  isDestructive: boolean;
}

export interface CommandState {
  isActive: boolean;
  actionId: string | null;
  actionTitle: string;
  sourceCharacterId: number | null;
  targetCharacterId: number | null;
  args: Record<string, any>;
  actionDetails: ActionDetails | null;
  readyToExecute: boolean;
  missingFields: string[];
}

interface ActionCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCommandStateChange: (state: CommandState) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Compact dropdown component
interface CompactDropdownProps {
  options: { id: string | number; label: string; sublabel?: string }[];
  value: string | number | null;
  onSelect: (id: string | number) => void;
  position: { top: number; left: number };
  isOpen: boolean;
  onClose: () => void;
  filter?: string;
  showId?: boolean;
}

const CompactDropdown: React.FC<CompactDropdownProps> = ({
  options,
  value,
  onSelect,
  position,
  isOpen,
  onClose,
  filter = '',
  showId = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(filter.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(filter.toLowerCase())) ||
    String(opt.id).toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, options]);

  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  // Close on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isOpen) {
        onClose();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [isOpen, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredOptions[selectedIndex]) {
          onSelect(filteredOptions[selectedIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredOptions, selectedIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="compact-dropdown"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateY(-100%)',
      }}
    >
      <div className="compact-dropdown-list" ref={listRef}>
        {filteredOptions.length === 0 ? (
          <div className="compact-dropdown-empty">No matches</div>
        ) : (
          filteredOptions.map((opt, idx) => (
            <div
              key={opt.id}
              className={`compact-dropdown-item ${idx === selectedIndex ? 'selected' : ''} ${value === opt.id ? 'active' : ''}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className="item-label">{opt.label}</span>
              {showId && <span className="item-id">{opt.id}</span>}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
};

const ActionCommandInput: React.FC<ActionCommandInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onCommandStateChange,
  placeholder = "Write a message...",
  disabled = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Token refs for positioning dropdowns
  const sourceTokenRef = useRef<HTMLSpanElement>(null);
  const targetTokenRef = useRef<HTMLSpanElement>(null);
  const argTokenRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  
  // Data state
  const [actions, setActions] = useState<ActionSummary[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  
  // UI state
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // Command state
  const [selectedAction, setSelectedAction] = useState<ActionSummary | null>(null);
  const [actionDetails, setActionDetails] = useState<ActionDetails | null>(null);
  const [sourceCharacter, setSourceCharacter] = useState<Character | null>(null);
  const [targetCharacter, setTargetCharacter] = useState<Character | null>(null);
  const [args, setArgs] = useState<Record<string, any>>({});
  
  // Current field being edited
  const [currentField, setCurrentField] = useState<'action' | 'source' | 'target' | null>(null);
  const [openEnumArg, setOpenEnumArg] = useState<string | null>(null);

  // Load actions and characters on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [actionsData, convData] = await Promise.all([
          window.actionsAPI.getAll(),
          window.conversationAPI.getActiveConversationData()
        ]);
        
        setActions(actionsData.filter(a => !a.disabled && a.validation.valid));
        
        if (convData?.characters) {
          setCharacters(convData.characters);
        }
      } catch (error) {
        console.error('Failed to load action command data:', error);
      }
    };
    
    loadData();
  }, []);

  // Get dropdown position from element
  const getPositionFromRef = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      return {
        top: rect.top - 5,
        left: rect.left,
      };
    }
    return { top: 0, left: 0 };
  }, []);

  // Calculate and emit command state
  useEffect(() => {
    if (!value.startsWith('/') || !selectedAction) {
      onCommandStateChange({
        isActive: false,
        actionId: null,
        actionTitle: '',
        sourceCharacterId: null,
        targetCharacterId: null,
        args: {},
        actionDetails: null,
        readyToExecute: false,
        missingFields: [],
      });
      return;
    }

    const missingFields: string[] = [];
    
    if (!sourceCharacter) missingFields.push('source');
    if (actionDetails?.requiresTarget && !targetCharacter) missingFields.push('target');
    
    actionDetails?.args?.forEach(arg => {
      if (arg.required && (args[arg.name] === undefined || args[arg.name] === '')) {
        missingFields.push(arg.displayName || arg.name);
      }
    });

    const ready = missingFields.length === 0 && !!sourceCharacter;

    onCommandStateChange({
      isActive: true,
      actionId: selectedAction.id,
      actionTitle: selectedAction.title,
      sourceCharacterId: sourceCharacter?.id ?? null,
      targetCharacterId: targetCharacter?.id ?? null,
      args,
      actionDetails,
      readyToExecute: ready,
      missingFields,
    });
  }, [value, selectedAction, sourceCharacter, targetCharacter, args, actionDetails, onCommandStateChange]);

  // Parse input to detect action selection
  useEffect(() => {
    if (!value.startsWith('/')) {
      setSelectedAction(null);
      setActionDetails(null);
      setSourceCharacter(null);
      setTargetCharacter(null);
      setArgs({});
      setCurrentField(null);
      setOpenEnumArg(null);
      return;
    }

    const text = value.slice(1);
    const parts = text.split(/\s+/).filter(p => p.length > 0);
    const partialSig = parts[0] || '';
    
    // Find matching action
    const matchedAction = actions.find(a => 
      a.id.toLowerCase() === partialSig.toLowerCase()
    );
    
    if (matchedAction && matchedAction.id !== selectedAction?.id) {
      setSelectedAction(matchedAction);
    }
    
    // Show action dropdown while typing signature
    if (parts.length === 0 || (parts.length === 1 && !text.endsWith(' '))) {
      setCurrentField('action');
      // Update position for action dropdown (use textarea position)
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setDropdownPosition({ top: rect.top - 5, left: rect.left });
      }
    } else {
      setCurrentField(null);
    }
  }, [value, actions, selectedAction]);

  // Fetch action details when source character is selected
  useEffect(() => {
    const fetchDetails = async () => {
      if (!selectedAction || !sourceCharacter) {
        setActionDetails(null);
        return;
      }
      
      try {
        const details = await window.actionsAPI.getDetails(selectedAction.id, sourceCharacter.id);
        setActionDetails(details);
      } catch (error) {
        console.error('Failed to get action details:', error);
      }
    };
    
    fetchDetails();
  }, [selectedAction, sourceCharacter]);

  // Handle input change
  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  // Handle textarea click - close any open dropdown
  const handleTextareaClick = () => {
    if (currentField || openEnumArg) {
      setCurrentField(null);
      setOpenEnumArg(null);
    }
  };

  // Select action from dropdown
  const selectAction = (actionId: string | number) => {
    const action = actions.find(a => a.id === actionId);
    if (action) {
      setSelectedAction(action);
      onChange(`/${action.id} `);
      setCurrentField(null);
    }
  };

  // Select source character
  const selectSourceCharacter = (charId: string | number) => {
    const char = characters.find(c => c.id === charId);
    if (char) {
      setSourceCharacter(char);
      setCurrentField(null);
    }
  };

  // Select target character
  const selectTargetCharacter = (charId: string | number) => {
    const char = characters.find(c => c.id === charId);
    if (char) {
      setTargetCharacter(char);
      setCurrentField(null);
    }
  };

  // Select enum value
  const selectEnumValue = (argName: string, value: string | number) => {
    setArgs(prev => ({ ...prev, [argName]: value }));
    setOpenEnumArg(null);
  };

  // Open dropdown for source character
  const openSourceDropdown = () => {
    setDropdownPosition(getPositionFromRef(sourceTokenRef));
    setCurrentField('source');
    setOpenEnumArg(null);
  };

  // Open dropdown for target character
  const openTargetDropdown = () => {
    setDropdownPosition(getPositionFromRef(targetTokenRef));
    setCurrentField('target');
    setOpenEnumArg(null);
  };

  // Open dropdown for enum arg
  const openEnumDropdown = (argName: string) => {
    const ref = { current: argTokenRefs.current.get(argName) || null };
    setDropdownPosition(getPositionFromRef(ref as React.RefObject<HTMLElement>));
    setOpenEnumArg(argName);
    setCurrentField(null);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && (currentField || openEnumArg)) {
      e.preventDefault();
      setCurrentField(null);
      setOpenEnumArg(null);
      return;
    }
    
    if (e.key === 'Escape' && value.startsWith('/')) {
      e.preventDefault();
      onChange('');
      setCurrentField(null);
      setOpenEnumArg(null);
      return;
    }

    onKeyPress(e);
  };

  // Render inline tokens in the input
  const renderInlineTokens = () => {
    if (!value.startsWith('/')) return null;
    
    const tokens: React.ReactNode[] = [];
    
    // Source character token
    if (selectedAction) {
      tokens.push(
        <span 
          key="source" 
          ref={sourceTokenRef}
          className={`inline-token ${sourceCharacter ? 'filled' : 'empty'}`}
          onClick={openSourceDropdown}
        >
          {sourceCharacter ? `@${sourceCharacter.fullName}` : '@source'}
        </span>
      );
      
      // Target character token (always show for debug)
      tokens.push(
        <span 
          key="target" 
          ref={targetTokenRef}
          className={`inline-token ${targetCharacter ? 'filled' : 'empty'} ${actionDetails?.requiresTarget && !targetCharacter ? 'required' : ''}`}
          onClick={openTargetDropdown}
        >
          {targetCharacter ? `@${targetCharacter.fullName}` : '@target'}
        </span>
      );
      
      // Arg tokens
      actionDetails?.args?.forEach(arg => {
        const argValue = args[arg.name];
        const isFilled = argValue !== undefined && argValue !== '' && argValue !== null;
        
        tokens.push(
          <span 
            key={`arg-${arg.name}`}
            ref={(el) => { if (el) argTokenRefs.current.set(arg.name, el); }}
            className={`inline-token ${isFilled ? 'filled' : 'empty'} ${arg.required && !isFilled ? 'required' : ''}`}
            onClick={(e) => {
              // For enum tokens, clicking anywhere except the value (which already has its own handler)
              // should open the dropdown.
              if (arg.type === 'enum') {
                openEnumDropdown(arg.name);
              } 
              // For text/number tokens, focus the input when clicking the label or surrounding area.
              else if (arg.type !== 'boolean') {
                const input = e.currentTarget.querySelector('input');
                input?.focus();
              }
              // Boolean tokens are ignored – the checkbox handles its own interaction.
            }}
          >
            <span className="token-label">{arg.displayName || arg.name}:</span>
            
            {arg.type === 'enum' && arg.options ? (
              <span 
                className="token-enum"
                onClick={() => openEnumDropdown(arg.name)}
              >
                {argValue || '...'}
              </span>
            ) : arg.type === 'boolean' ? (
              <input
                type="checkbox"
                className="token-checkbox"
                checked={Boolean(argValue)}
                onChange={(e) => setArgs(prev => ({ ...prev, [arg.name]: e.target.checked }))}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <input
                type={arg.type === 'number' ? 'number' : 'text'}
                className="token-input"
                value={argValue ?? ''}
                onChange={(e) => setArgs(prev => ({ ...prev, [arg.name]: e.target.value }))}
                onClick={(e) => e.stopPropagation()}
                placeholder="..."
                min={arg.min}
                max={arg.max}
              />
            )}
          </span>
        );
      });
    }
    
    if (tokens.length === 0) return null;
    
    return <div className="inline-tokens">{tokens}</div>;
  };

  // Render dropdowns
  const renderDropdowns = () => {
    // Action dropdown
    if (currentField === 'action' || (!selectedAction && value.startsWith('/') && value.length > 1)) {
      const actionOptions = actions.map(a => ({
        id: a.id,
        label: a.title,
        sublabel: a.id,
      }));
      
      const filterText = value.slice(1).split(/\s+/)[0] || '';
      
      return (
        <CompactDropdown
          options={actionOptions}
          value={selectedAction?.id || null}
          onSelect={selectAction}
          position={dropdownPosition}
          isOpen={true}
          onClose={() => setCurrentField(null)}
          filter={filterText}
          showId
        />
      );
    }

    // Source character dropdown
    if (currentField === 'source') {
      const charOptions = characters.map(c => ({
        id: c.id,
        label: `@${c.fullName}`,
        sublabel: c.shortName,
      }));
      
      return (
        <CompactDropdown
          options={charOptions}
          value={sourceCharacter?.id || null}
          onSelect={selectSourceCharacter}
          position={dropdownPosition}
          isOpen={true}
          onClose={() => setCurrentField(null)}
        />
      );
    }

    // Target character dropdown
    if (currentField === 'target') {
      const charOptions = characters.map(c => ({
        id: c.id,
        label: `@${c.fullName}`,
        sublabel: c.shortName,
      }));
      
      return (
        <CompactDropdown
          options={charOptions}
          value={targetCharacter?.id || null}
          onSelect={selectTargetCharacter}
          position={dropdownPosition}
          isOpen={true}
          onClose={() => setCurrentField(null)}
        />
      );
    }

    // Enum arg dropdown
    if (openEnumArg && actionDetails?.args) {
      const arg = actionDetails.args.find(a => a.name === openEnumArg);
      if (arg?.type === 'enum' && arg.options) {
        const enumOptions = arg.options.map(opt => ({
          id: opt,
          label: opt,
        }));
        
        return (
          <CompactDropdown
            options={enumOptions}
            value={args[openEnumArg] || null}
            onSelect={(val) => selectEnumValue(openEnumArg, val)}
            position={dropdownPosition}
            isOpen={true}
            onClose={() => setOpenEnumArg(null)}
          />
        );
      }
    }

    return null;
  };

  return (
    <div className="action-command-input-wrapper" ref={wrapperRef}>
      <textarea
        ref={textareaRef}
        className={`chat-input ${disabled ? 'disabled' : ''}`}
        placeholder={placeholder}
        rows={3}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={handleTextareaClick}
        disabled={disabled}
      />
      
      {/* Inline tokens overlay */}
      {renderInlineTokens()}
      
      {/* Dropdowns */}
      {renderDropdowns()}
    </div>
  );
};

export default ActionCommandInput;
