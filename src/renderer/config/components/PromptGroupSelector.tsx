import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  buildGroups,
  findGroupForPath,
  KNOWN_LOCALES,
  UNSPECIFIED_LOCALE,
} from '../utils/promptFileGroups';
import './PromptGroupSelector.scss';

interface PromptGroupSelectorProps {
  files: string[];
  currentScriptPath: string;
  appLanguage: string;
  onSelect: (scriptPath: string) => void;
  ariaLabel?: string;
}

type BadgeState = 'match' | 'fallback' | 'unspecified';

function localeDisplayName(code: string): string {
  if (code === UNSPECIFIED_LOCALE) return '—';
  return code.toUpperCase();
}

function badgeState(selectedLocale: string, appLanguage: string): BadgeState {
  if (selectedLocale === UNSPECIFIED_LOCALE) return 'unspecified';
  if (selectedLocale === appLanguage.toLowerCase()) return 'match';
  if (selectedLocale === 'en' && appLanguage.toLowerCase() !== 'en') return 'fallback';
  return 'unspecified';
}

function computeDropdownPosition(
  btnRect: DOMRect,
 dropdownWidth: number,
  maxHeight: number,
): { top: number; left: number; openUp: boolean; maxHeight: number } {
  const pad = 8;
  const spaceBelow = window.innerHeight - btnRect.bottom - pad;
  const spaceAbove = btnRect.top - pad;
  const openUp = spaceBelow < maxHeight && spaceAbove > spaceBelow;
  const top = openUp
    ? btnRect.top - pad // will be combined with maxHeight in the style
    : btnRect.bottom + pad;
  const left = Math.min(btnRect.left, window.innerWidth - dropdownWidth - pad);
  const clampedLeft = Math.max(pad, left);
  // Clamp maxHeight so it never overflows the viewport.
  const available = openUp
    ? Math.min(spaceAbove, maxHeight)
    : Math.min(spaceBelow, maxHeight);
  return { top, left: clampedLeft, openUp, maxHeight: Math.max(120, available) };
}

const PromptGroupSelector: React.FC<PromptGroupSelectorProps> = ({
  files,
  currentScriptPath,
  appLanguage,
  onSelect,
  ariaLabel,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => buildGroups(files), [files]);

  const currentGroup = useMemo(
    () => findGroupForPath(groups, currentScriptPath),
    [groups, currentScriptPath],
  );

  const currentLocale = useMemo(() => {
    const norm = currentScriptPath.replace(/\\/g, '/');
    return currentGroup?.locales.find((l) => l.path === norm)?.code ?? UNSPECIFIED_LOCALE;
  }, [currentGroup, currentScriptPath]);

  const activeBadge = badgeState(currentLocale, appLanguage);

  const rafRef = useRef<number>(0);
  const recalcPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const DROPDOWN_WIDTH = 320;
    const MAX_H = Math.floor(window.innerHeight * 0.4);
    const pos = computeDropdownPosition(
      buttonRef.current.getBoundingClientRect(),
      DROPDOWN_WIDTH,
      MAX_H,
    );
    setDropdownStyle({
      position: 'fixed',
      top: pos.openUp ? undefined : `${pos.top}px`,
      bottom: pos.openUp ? `${window.innerHeight - pos.top}px` : undefined,
      left: `${pos.left}px`,
      width: `${DROPDOWN_WIDTH}px`,
      maxHeight: `${pos.maxHeight}px`,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    recalcPosition();
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalcPosition);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen, recalcPosition]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleVisibilityChange() {
      if (document.hidden) setIsOpen(false);
    }
    function handleWindowBlur() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setExpandedGroup(currentGroup?.id ?? null);
    }
  }, [isOpen, currentGroup]);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelectVariant = (path: string) => {
    onSelect(path);
    setIsOpen(false);
  };

  const triggerLabel = currentGroup ? currentGroup.displayName : currentScriptPath;

  return (
    <div className="prompt-group-selector">
      <button
        ref={buttonRef}
        type="button"
        className={`prompt-group-trigger ${isOpen ? 'open' : ''}`}
        onClick={toggleOpen}
        aria-label={ariaLabel}
        title={currentScriptPath}
      >
        <span className="prompt-group-trigger-name">{triggerLabel}</span>
        <span className={`prompt-lang-badge ${activeBadge}`}>
          {localeDisplayName(currentLocale)}
        </span>
        <span className="prompt-group-caret">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="prompt-group-dropdown"
          style={dropdownStyle}
        >
          <div className="prompt-group-dropdown-header">
            <span className="prompt-group-dropdown-title">
              {t('prompts.selectPromptGroup')}
            </span>
          </div>
          <div className="prompt-group-list">
            {groups.length === 0 && (
              <div className="prompt-group-empty">{t('prompts.noPromptFiles')}</div>
            )}
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.id;
              const isActive = currentGroup?.id === group.id;
              return (
                <div key={group.id} className={`prompt-group-row ${isActive ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="prompt-group-row-header"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                  >
                    <span className="prompt-group-row-name">
                      {isExpanded ? '▾' : '▸'} {group.displayName}
                    </span>
                    <span className="prompt-group-row-flags">
                      {group.locales.map((l) => (
                        <span
                          key={l.code}
                          className={`prompt-lang-badge mini ${
                            l.code === appLanguage.toLowerCase() ? 'match' :
                            l.code === 'en' ? 'neutral' : 'muted'
                          }`}
                          title={l.path}
                        >
                          {localeDisplayName(l.code)}
                        </span>
                      ))}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="prompt-group-variants">
                      {group.locales.map((l) => {
                        const isCurrent = l.path === currentScriptPath.replace(/\\/g, '/');
                        return (
                          <button
                            key={l.code}
                            type="button"
                            className={`prompt-group-variant ${isCurrent ? 'current' : ''}`}
                            onClick={() => handleSelectVariant(l.path)}
                          >
                            <span className="prompt-lang-badge mini neutral">
                              {localeDisplayName(l.code)}
                            </span>
                            <span className="prompt-group-variant-path">{l.path}</span>
                            {isCurrent && <span className="checkmark">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default PromptGroupSelector;

export { KNOWN_LOCALES };
