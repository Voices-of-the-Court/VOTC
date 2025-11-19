import React, { useEffect, useMemo, useState } from 'react';

type ActionListItem = {
  id: string;
  title: string;
  scope: 'standard' | 'custom';
  filePath: string;
  validation: { valid: boolean; message?: string };
  disabled: boolean;
};

const ActionsView: React.FC = () => {
  const [allActions, setAllActions] = useState<ActionListItem[]>([]);
  const [hideDisabled, setHideDisabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyInvalid, setShowOnlyInvalid] = useState<boolean>(false);

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Load settings (for disabled state cache)
      const settings = await (window as any).actionsAPI?.getSettings?.();
      // Load actions
      const items: ActionListItem[] = await (window as any).actionsAPI?.getAll?.();
      // Overlay disabled from settings just in case
      const disabledSet = new Set<string>(settings?.disabledActions || []);
      const merged = items.map(a => ({
        ...a,
        disabled: disabledSet.has(a.id) || a.disabled === true,
      }));
      setAllActions(merged);
    } catch (e: any) {
      setError(e?.message || 'Failed to load actions.');
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
    // Stable sorted: invalid first, then by scope, then alpha by title
    return [...list].sort((a, b) => {
      if (a.validation.valid !== b.validation.valid) return a.validation.valid ? 1 : -1;
      if (a.scope !== b.scope) return a.scope === 'standard' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [allActions, hideDisabled, showOnlyInvalid]);

  const toggleDisabled = async (id: string, current: boolean) => {
    try {
      await (window as any).actionsAPI?.setDisabled?.(id, !current);
      // refresh in memory state
      setAllActions(prev =>
        prev.map(a => (a.id === id ? { ...a, disabled: !current } : a))
      );
    } catch (e: any) {
      alert(`Failed to update action state: ${e?.message || e}`);
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
      alert(`Failed to open actions folder: ${e?.message || e}`);
    }
  };

  const reload = async () => {
    try {
      setIsLoading(true);
      await (window as any).actionsAPI?.reload?.();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to reload actions.');
      setIsLoading(false);
    }
  };

  return (
    <div className="actions-view">
      <div className="actions-toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <button type="button" onClick={reload} title="Reload actions">🔄 Reload</button>
        <button type="button" onClick={openFolder} title="Open actions folder">📂 Open Actions Folder</button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={hideDisabled}
            onChange={(e) => setHideDisabled(e.target.checked)}
          />
          Hide disabled
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={showOnlyInvalid}
            onChange={(e) => setShowOnlyInvalid(e.target.checked)}
          />
          Show only invalid
        </label>
      </div>

      {isLoading && <div>Loading actions...</div>}
      {error && <div className="error">{error}</div>}

      {!isLoading && !error && (
        <div className="actions-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'white' }}>
          {visibleActions.map((a) => {
            const mutedStyle = a.disabled ? { opacity: 0.5 } : undefined;
            const validationIcon = a.validation.valid ? '✅' : '⚠️';
            const validationTitle = a.validation.valid ? 'Valid action' : (a.validation.message || 'Invalid action');

            return (
              <div
                key={a.id}
                className="action-item"
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  padding: 10,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  ...mutedStyle
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 24 }}>
                  <input
                    type="checkbox"
                    checked={!a.disabled}
                    onChange={() => toggleDisabled(a.id, a.disabled)}
                    title={a.disabled ? 'Enable action' : 'Disable action'}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{a.title}</strong>
                    <span
                      style={{ cursor: a.validation.valid ? 'default' : 'pointer' }}
                      title={validationTitle}
                      onClick={() => !a.validation.valid && copyValidationMessage(a.validation.message)}
                    >
                      {validationIcon}
                    </span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      [{a.scope}]&nbsp;{a.id}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    <span title={a.filePath}>{a.filePath}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {visibleActions.length === 0 && (
            <div style={{ opacity: 0.7 }}>
              No actions to display with the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionsView;