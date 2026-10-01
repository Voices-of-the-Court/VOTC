import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectionTestResult, ConnectionTestSubResult } from '@llmTypes';
import {
  useConfigStore,
  useTestStatus,
  useTestSteps,
  useTestElapsedMs,
  useTestResult,
  type TestStepId,
  type TestStepStatus,
} from '../store/useConfigStore';

const STEP_LABEL_KEY: Record<TestStepId, string> = {
  text: 'connection.testTextGeneration',
  advanced: 'connection.testStructuredAdvanced',
  minimized: 'connection.testStructuredMinimized',
};

interface RenderStep {
  id: TestStepId;
  status: TestStepStatus;
  message?: string;
}

function getDetail(step: RenderStep): string | undefined {
  return step.status === 'done' || step.status === 'error' ? step.message : undefined;
}

const TestStatusDot: React.FC<{ status: TestStepStatus }> = ({ status }) => (
  <span className={`test-status-dot ${status}`} aria-hidden="true" />
);

const formatElapsed = (ms: number): string => {
  const s = ms / 1000;
  return ms < 10000 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
};

function stepsFromResult(result: ConnectionTestResult | null): RenderStep[] {
  const empty: RenderStep[] = [
    { id: 'text', status: 'pending' },
    { id: 'advanced', status: 'pending' },
    { id: 'minimized', status: 'pending' },
  ];
  if (!result) return empty;

  const tg = result.textGeneration;
  const adv = result.structuredOutput?.find((s) => s.name?.toLowerCase().includes('advanced'));
  const min = result.structuredOutput?.find((s) => s.name?.toLowerCase().includes('minimized'));

  const statusOf = (s?: ConnectionTestSubResult): TestStepStatus =>
    s ? (s.success ? 'done' : 'error') : 'pending';
  const messageOf = (s?: ConnectionTestSubResult): string | undefined =>
    s ? (s.success ? s.message : s.error) : undefined;

  return [
    { id: 'text', status: statusOf(tg), message: messageOf(tg) },
    { id: 'advanced', status: statusOf(adv), message: messageOf(adv) },
    { id: 'minimized', status: statusOf(min), message: messageOf(min) },
  ];
}

const Recommendation: React.FC<{ result: ConnectionTestResult; t: any }> = ({ result, t }) => {
  const steps = result.structuredOutput ?? [];
  const advanced = steps.find((s) => s.name?.toLowerCase().includes('advanced'));
  const minimized = steps.find((s) => s.name?.toLowerCase().includes('minimized'));
  if (advanced && !advanced.success && minimized && minimized.success) {
    return (
      <p className="test-recommendation">
        {t(
          'connection.testRecommendMinimized',
          'This model only supports the minimized schema. Set "Actions Schema Type" to "Minimized" so Actions work reliably.'
        )}
      </p>
    );
  }
  return null;
};

const CopyableDetails: React.FC<{ result: ConnectionTestResult; t: any }> = ({ result, t }) => {
  const [copied, setCopied] = React.useState(false);

  const buildText = () => {
    const lines: string[] = [];
    if (result.textGeneration) {
      lines.push(`Text generation: ${result.textGeneration.success ? 'OK' : 'FAILED'}`);
      const m = result.textGeneration.success ? result.textGeneration.message : result.textGeneration.error;
      if (m) lines.push(`  ${m}`);
    }
    for (const s of result.structuredOutput ?? []) {
      lines.push(`${s.name ?? 'Structured output'}: ${s.success ? 'OK' : 'FAILED'}`);
      const m = s.success ? s.message : s.error;
      if (m) lines.push(`  ${m}`);
    }
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button type="button" className="test-copy-btn" onClick={handleCopy}>
      {copied ? t('connection.testCopied', 'Copied!') : t('connection.testCopyDetails', 'Copy details')}
    </button>
  );
};

const ConnectionTestPanel: React.FC = () => {
  const { t } = useTranslation();
  const testStatus = useTestStatus();
  const liveSteps = useTestSteps();
  const testElapsedMs = useTestElapsedMs();
  const testResult = useTestResult();

  const testConnection = useConfigStore((s) => s.testConnection);
  const cancelTestConnection = useConfigStore((s) => s.cancelTestConnection);

  const running = testStatus === 'running';
  const hasResult = !!testResult;

  const [expanded, setExpanded] = React.useState<Partial<Record<TestStepId, boolean>>>({});
  React.useEffect(() => {
    if (running) setExpanded({}); // reset when a new test starts
  }, [running]);

  const steps: RenderStep[] = running
    ? liveSteps.map((s) => ({ id: s.id, status: s.status, message: s.message }))
    : stepsFromResult(testResult);

  const structured = testResult?.structuredOutput ?? [];
  const allPassed =
    !!testResult?.textGeneration?.success && structured.length > 0 && structured.every((s) => s.success);
  const anyPassed = !!testResult?.textGeneration?.success || structured.some((s) => s.success);

  type Tone = 'idle' | 'running' | 'success' | 'partial' | 'error';
  const headerTone: Tone = running
    ? 'running'
    : !testResult
      ? 'idle'
      : allPassed
        ? 'success'
        : anyPassed
          ? 'partial'
          : 'error';

  const headerLabel = running
    ? t('connection.testRunning', 'Testing connection…')
    : !testResult
      ? ''
      : allPassed
        ? t('connection.testAllPassed', 'All checks passed')
        : anyPassed
          ? t('connection.testPartial', 'Partial support — Actions may fail')
          : t('connection.testFailed', 'Connection test failed');

  const isDetailVisible = (step: RenderStep): boolean => {
    if (!getDetail(step)) return false;
    const override = expanded[step.id];
    return override !== undefined ? override : step.status === 'error';
  };

  const handleToggle = (step: RenderStep) => {
    if (!getDetail(step)) return;
    setExpanded((prev) => ({ ...prev, [step.id]: !isDetailVisible(step) }));
  };

  return (
    <div className={`connection-test-panel tone-${headerTone}${running ? ' running' : ''}`}>
      <div className="connection-test-header">
        <span className="connection-test-title">
          {t('connection.testPanelTitle', 'Connection test')}
          {(running || hasResult) && <span className="connection-test-status">{headerLabel}</span>}
        </span>
        {(running || hasResult) && (
          <span className="connection-test-elapsed">{formatElapsed(testElapsedMs)}</span>
        )}
      </div>

      {/* Steps checklist */}
      <div className="connection-test-steps">
        {steps.map((step) => {
          const detail = getDetail(step);
          const clickable = !!detail;
          const visible = isDetailVisible(step);
          return (
            <div key={step.id} className={`test-step-row ${step.status}`}>
              <div
                className={`test-step-main${clickable ? ' clickable' : ''}`}
                onClick={() => handleToggle(step)}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggle(step);
                        }
                      }
                    : undefined
                }
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-expanded={clickable ? visible : undefined}
              >
                <TestStatusDot status={step.status} />
                <span className="test-step-label">{t(STEP_LABEL_KEY[step.id])}</span>
                {step.status === 'running' && (
                  <span className="test-step-running">{t('connection.testStepRunning', 'running…')}</span>
                )}
                {clickable && (
                  <span className="test-step-chevron" aria-hidden="true">
                    {visible ? '▾' : '▸'}
                  </span>
                )}
              </div>
              {detail && visible && <div className="test-step-detail">{detail}</div>}
            </div>
          );
        })}
      </div>

      {/* Footer: action buttons */}
      <div className="connection-test-footer">
        {running ? (
          <button type="button" className="test-cancel-btn" onClick={() => cancelTestConnection()}>
            {t('connection.testCancel', 'Cancel')}
          </button>
        ) : (
          <>
            <button type="button" className="test-run-btn" onClick={() => testConnection()}>
              {hasResult
                ? t('connection.testReRun', 'Re-run test')
                : t('connection.testConnection', 'Test Connection')}
            </button>
            {hasResult && testResult && <CopyableDetails result={testResult} t={t} />}
          </>
        )}
      </div>

      {!running && testResult && <Recommendation result={testResult} t={t} />}
    </div>
  );
};

export default ConnectionTestPanel;
