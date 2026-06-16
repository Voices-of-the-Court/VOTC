import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../store/useConfigStore';
import { localeDisplayName } from '../supportedLanguages';
import './PromptLocaleNotification.scss';

const PromptLocaleNotification: React.FC = () => {
  const { t } = useTranslation();
  const switches = useConfigStore((s) => s.promptLocaleSwitches);
  const revert = useConfigStore((s) => s.revertPromptLocaleSwitches);
  const dismiss = useConfigStore((s) => s.dismissPromptLocaleSwitches);
  const [isReverting, setIsReverting] = useState(false);

  if (switches.length === 0) return null;

  const targetLang = switches[0].toLocale;
  const hasFallback = switches.some((s) => s.reason === 'fallback_en');

  const handleRevert = async () => {
    if (isReverting) return;
    setIsReverting(true);
    try {
      await revert();
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div
      className="prompt-locale-notification-overlay"
      onMouseEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
      onMouseLeave={() => window.electronAPI?.setIgnoreMouseEvents(true)}
    >
      <div className="prompt-locale-notification-card">
        <div className="prompt-locale-notification-header">
          <span className="prompt-locale-notification-title">
            {t('prompts.promptLocaleSwitchedTitle')}
          </span>
          <button
            className="prompt-locale-notification-close"
            onClick={dismiss}
            aria-label={t('prompts.promptLocaleSwitchedDismiss')}
            title={t('prompts.promptLocaleSwitchedDismiss')}
          >
            ✕
          </button>
        </div>
        <p className="prompt-locale-notification-desc">
          {t('prompts.promptLocaleSwitchedDesc', { language: localeDisplayName(targetLang) })}
        </p>
        <ul className="prompt-locale-notification-list">
          {switches.map((s) => (
            <li
              key={s.id}
              className={`prompt-locale-notification-item ${s.reason === 'fallback_en' ? 'fallback' : 'match'}`}
            >
              <span className="prompt-locale-notification-label">{s.blockLabel}</span>
              <span className="prompt-locale-notification-path">
                {s.fromLocale !== 'unspecified' ? localeDisplayName(s.fromLocale) : '?'}
                {' → '}
                {localeDisplayName(s.toLocale)}
              </span>
              {s.reason === 'fallback_en' && (
                <span className="prompt-locale-notification-fallback-tag">
                  {t('prompts.promptLocaleSwitchedFallback', { language: localeDisplayName(targetLang) })}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="prompt-locale-notification-actions">
          <button
            className="prompt-locale-notification-btn revert"
            onClick={handleRevert}
            disabled={isReverting}
          >
            {isReverting ? t('common.processing') : t('prompts.promptLocaleSwitchedRevert')}
          </button>
          <button
            className="prompt-locale-notification-btn dismiss"
            onClick={dismiss}
          >
            {t('prompts.promptLocaleSwitchedDismiss')}
          </button>
        </div>
        {hasFallback && (
          <p className="prompt-locale-notification-hint">
            {t('prompts.promptLocaleSwitchedHint')}
          </p>
        )}
      </div>
    </div>
  );
};

export default PromptLocaleNotification;
