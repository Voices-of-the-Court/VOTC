import type {
  ILLMProvider,
  ILLMCompletionRequest,
  ILLMCompletionResponse,
  LLMProviderConfig,
  ConnectionTestResult,
  ConnectionTestSubResult,
} from './types';

function resolveModel(config: LLMProviderConfig, override?: string): string {
  const model = override || config.defaultModel;
  if (!model) {
    throw new Error('No model selected for this provider.');
  }
  return model;
}

export async function runTextGenerationTest(
  provider: ILLMProvider,
  config: LLMProviderConfig,
  modelOverride?: string
): Promise<ConnectionTestSubResult> {
  try {
    const model = resolveModel(config, modelOverride);
    const request: ILLMCompletionRequest = {
      model,
      messages: [{ role: 'user', content: 'Hi.' }],
      max_tokens: 10,
      stream: false,
    };

    const response = await (provider.chatCompletion(request, config) as Promise<ILLMCompletionResponse>);
    if (response && (response.content || response.id)) {
      return {
        success: true,
        message: `Text generation OK (id: ${response.id ?? 'n/a'})`,
      };
    }
    return { success: false, error: 'No valid response received from the model.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown error during text generation test.' };
  }
}

/**
 * Provider-facing text-generation probe. Returns a *partial* ConnectionTestResult
 * (only `textGeneration` populated; `structuredOutput` is added later by the IPC
 * orchestrator via {@link finalizeConnectionTestResult}).
 *
 * @param options.model Optional model override (falls back to config.defaultModel).
 *   Used by providers that have a safe default model.
 */
export async function runConnectionTests(
  provider: ILLMProvider,
  config: LLMProviderConfig,
  options?: { model?: string }
): Promise<ConnectionTestResult> {
  const textGeneration = await runTextGenerationTest(provider, config, options?.model);
  return {
    success: textGeneration.success,
    message: textGeneration.success ? textGeneration.message : undefined,
    error: textGeneration.success ? undefined : textGeneration.error,
    textGeneration,
  };
}

/**
 * Merge the text-generation sub-result with structured-output sub-results
 * into the final ConnectionTestResult shown in UI.
 *
 * `success` = text generation passed AND at least one structured-output passed
 */
export function finalizeConnectionTestResult(
  textGeneration: ConnectionTestSubResult | undefined,
  structuredOutput: ConnectionTestSubResult[]
): ConnectionTestResult {
  const textOk = !!textGeneration?.success;
  const anyStructuredPassed = structuredOutput.some((r) => r.success);
  const allStructuredPassed = structuredOutput.length > 0 && structuredOutput.every((r) => r.success);
  const success = textOk && anyStructuredPassed;

  let message: string | undefined;
  let error: string | undefined;
  if (success) {
    if (allStructuredPassed) {
      message = 'All checks passed: text generation and both structured-output schemas are working.';
    } else {
      const passed = structuredOutput.filter((r) => r.success).map((r) => r.name).join(', ');
      const failed = structuredOutput.filter((r) => !r.success).map((r) => r.name).join(', ');
      message = `Text generation OK. Structured output partially supported — working: ${passed || 'none'}; unsupported: ${failed}.`;
    }
  } else {
    const failed: string[] = [];
    if (!textOk) failed.push('text generation');
    if (textOk && !anyStructuredPassed) failed.push('structured output');
    error = failed.length ? `Failed: ${failed.join(' and ')}.` : 'Connection test failed.';
  }

  return {
    success,
    error,
    message,
    textGeneration,
    structuredOutput,
  };
}
