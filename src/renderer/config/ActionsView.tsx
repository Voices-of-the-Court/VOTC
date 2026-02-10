import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AlertIcon from '../assets/Alert.png';

type ActionListItem = {
  id: string;
  title: string;
  scope: 'standard' | 'custom';
  filePath: string;
  validation: { valid: boolean; message?: string };
  disabled: boolean;
  isDestructive: boolean;
  hasDestructiveOverride: boolean;
};

const ActionsView: React.FC = () => {
  const { t } = useTranslation();
  const [allActions, setAllActions] = useState<ActionListItem[]>([]);
  const [hideDisabled, setHideDisabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyInvalid, setShowOnlyInvalid] = useState<boolean>(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const settings = await (window as any).actionsAPI?.getSettings?.();
      const items: ActionListItem[] = await (window as any).actionsAPI?.getAll?.();
      const disabledSet = new Set<string>(settings?.disabledActions || []);
      const merged = items.map(a => ({
        ...a,
        disabled: disabledSet.has(a.id) || a.disabled === true,
      }));
      setAllActions(merged);
    } catch (e: any) {
      setError(e?.message || t('actions.failedToLoadActions'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleActions = useMemo(() => {
    let list = allActions;
    if (hideDisabled) {
      list = list.filter(a => !a.disabled);
    }
    if (showOnlyInvalid) {
      list = list.filter(a => !a.validation.valid);
    }
    return [...list].sort((a, b) => {
      if (a.validation.valid !== b.validation.valid) return a.validation.valid ? 1 : -1;
      if (a.scope !== b.scope) return a.scope === 'standard' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [allActions, hideDisabled, showOnlyInvalid]);

  const toggleDisabled = async (id: string, current: boolean) => {
    try {
      await (window as any).actionsAPI?.setDisabled?.(id, !current);
      setAllActions(prev =>
        prev.map(a => (a.id === id ? { ...a, disabled: !current } : a))
      );
    } catch (e: any) {
      alert(t('actions.failedToUpdateActionState', { error: e?.message || e }));
    }
  };

  const toggleDestructive = async (id: string, currentIsDestructive: boolean, hasOverride: boolean) => {
    try {
      let newValue: boolean | null;
      let newEffectiveValue: boolean;
      
      if (!hasOverride) {
        // No override exists, set override to opposite of current
        newValue = !currentIsDestructive;
        newEffectiveValue = !currentIsDestructive;
      } else {
        // Override exists, remove it (revert to default)
        // When removing override, the effective value becomes the opposite of current
        // (because the override was set to the opposite of the default)
        newValue = null;
        newEffectiveValue = !currentIsDestructive;
      }
      
      await (window as any).actionsAPI?.setDestructiveOverride?.(id, newValue);
      console.log('setDestructiveOverride', id, newValue);
      // Update state locally instead of reloading to preserve scroll position
      setAllActions(prev =>
        prev.map(a => (a.id === id ? {
          ...a,
          isDestructive: newEffectiveValue,
          hasDestructiveOverride: newValue !== null
        } : a))
      );
    } catch (e: any) {
      alert(t('actions.failedToUpdateActionState', { error: e?.message || e }));
    }
  };

  const copyValidationMessage = async (msg?: string) => {
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      // ignore
    }
  };

  const openFolder = async () => {
    try {
      await (window as any).actionsAPI?.openFolder?.();
    } catch (e: any) {
      alert(t('actions.failedToOpenActionsFolder', { error: e?.message || e }));
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const result = await (window as any).actionsAPI?.openFile?.(filePath);
      if (!result.success) {
        alert(t('actions.failedToOpenActionsFile', { error: result.error }));
      }
    } catch (e: any) {
      alert(t('actions.failedToOpenActionsFile', { error: e?.message || e }));
    }
  };

  const reload = async () => {
    try {
      setIsLoading(true);
      await (window as any).actionsAPI?.reload?.();
      await load();
    } catch (e: any) {
      setError(e?.message || t('actions.failedToReloadActions'));
      setIsLoading(false);
    }
  };

  const enableAllActions = async () => {
    try {
      const disabledActions = allActions.filter(a => a.disabled);
      for (const action of disabledActions) {
        await (window as any).actionsAPI?.setDisabled?.(action.id, false);
      }
      setAllActions(prev =>
        prev.map(a => ({ ...a, disabled: false }))
      );
    } catch (e: any) {
      alert(t('actions.failedToUpdateActionState', { error: e?.message || e }));
    }
  };

  const disableAllActions = async () => {
    try {
      const enabledActions = allActions.filter(a => !a.disabled);
      for (const action of enabledActions) {
        await (window as any).actionsAPI?.setDisabled?.(action.id, true);
      }
      setAllActions(prev =>
        prev.map(a => ({ ...a, disabled: true }))
      );
    } catch (e: any) {
      alert(t('actions.failedToUpdateActionState', { error: e?.message || e }));
    }
  };

  return (
    <div className="actions-view">
      <div className="actions-toolbar">
        <button type="button" onClick={reload}>🔄 {t('actions.reloadActions')}</button>
        <button type="button" onClick={openFolder}>📂 {t('actions.openActionsFolder')}</button>
        <button type="button" onClick={enableAllActions} className="enable-all-button">
          ✅ {t('actions.enableAllActions')}
        </button>
        <button type="button" onClick={disableAllActions} className="disable-all-button">
          ❌ {t('actions.disableAllActions')}
        </button>
        <label>
          <input
            type="checkbox"
            checked={hideDisabled}
            onChange={(e) => setHideDisabled(e.target.checked)}
          />
          {t('actions.hideDisabled')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={showOnlyInvalid}
            onChange={(e) => setShowOnlyInvalid(e.target.checked)}
          />
          {t('actions.showOnlyInvalid')}
        </label>
      </div>

      {isLoading && <div>{t('actions.loadingActions')}</div>}
      {error && <div className="error">{error}</div>}

      {!isLoading && !error && (
        <div className="actions-list">
          {visibleActions.map((a) => {
            const isHovered = hoveredAction === a.id;
            const titleClass = `action-title ${a.disabled ? 'disabled' : ''} ${!a.validation.valid ? 'invalid' : ''}`;

            return (
              <div
                key={a.id}
                className="action-item"
                onMouseEnter={() => setHoveredAction(a.id)}
                onMouseLeave={() => setHoveredAction(null)}
                title={!a.validation.valid ? a.validation.message : undefined}
              >
                <input
                  type="checkbox"
                  checked={!a.disabled}
                  onChange={() => toggleDisabled(a.id, a.disabled)}
                  title={a.disabled ? t('actions.enableAction') : t('actions.disableAction')}
                />
                <button
                  className={`destructive-icon-button ${
                    !a.validation.valid ? 'invalid' : 
                    a.isDestructive ? 'destructive' : 
                    'non-destructive'
                  } ${a.hasDestructiveOverride ? 'overridden' : ''}`}
                  onClick={() => a.validation.valid && toggleDestructive(a.id, a.isDestructive, a.hasDestructiveOverride)}
                  style={{ cursor: a.validation.valid ? 'pointer' : 'default' }}
                  title={
                    !a.validation.valid ? a.validation.message :
                    a.hasDestructiveOverride
                      ? t('actions.destructiveOverridden', { state: a.isDestructive ? t('actions.destructive') : t('actions.nonDestructive') })
                      : a.isDestructive
                      ? t('actions.destructive')
                      : t('actions.nonDestructive')
                  }
                >
                  <img src={AlertIcon} alt="Destructive indicator" />
                </button>
                <span 
                  className={titleClass}
                  onClick={() => !a.validation.valid && copyValidationMessage(a.validation.message)}
                  style={{ cursor: !a.validation.valid ? 'pointer' : 'default' }}
                >
                  {a.title}
                </span>
                {isHovered && (
                  <span className="action-meta">
                    [{a.scope}] {a.id}
                  </span>
                )}
                <button
                  className="open-file-button"
                  onClick={() => openFile(a.filePath)}
                  title={a.filePath}
                >
                {t('actions.openFile')}  📄
                </button>
              </div>
            );
          })}

          {visibleActions.length === 0 && (
            <div className="empty-state">
              {t('actions.noActionsToDisplay')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionsView;
