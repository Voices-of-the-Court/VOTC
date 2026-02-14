import React, { useState, useEffect, useRef, useCallback } from 'react';

interface HandlebarsTextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}

/**
 * A textarea that validates Handlebars template syntax on change,
 * showing an error indicator and message when the template is invalid.
 */
const HandlebarsTextarea: React.FC<HandlebarsTextareaProps> = ({
  value,
  onChange,
  rows = 4,
  placeholder,
  className,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);
  const validateTimer = useRef<NodeJS.Timeout | null>(null);

  const validate = useCallback(async (template: string) => {
    if (!template || !template.includes('{{')) {
      setValidationError(null);
      return;
    }

    try {
      const result = await window.promptsAPI.validateTemplate(template);
      if (!result.valid) {
        // Extract a concise error message
        let errorMsg = result.error || 'Invalid template syntax';
        // Handlebars errors can be verbose - take the meaningful part
        const expectingMatch = errorMsg.match(/(Expecting .+)/);
        if (expectingMatch) {
          errorMsg = expectingMatch[1];
        }
        const lineInfo = result.line ? ` (line ${result.line})` : '';
        setValidationError(`${errorMsg}${lineInfo}`);
      } else {
        setValidationError(null);
      }
    } catch (err) {
      // IPC error - don't show validation state
      setValidationError(null);
    }
  }, []);

  useEffect(() => {
    if (validateTimer.current) {
      clearTimeout(validateTimer.current);
    }
    validateTimer.current = setTimeout(() => {
      validate(value);
    }, 500);

    return () => {
      if (validateTimer.current) {
        clearTimeout(validateTimer.current);
      }
    };
  }, [value, validate]);

  const hasError = validationError !== null;

  return (
    <div className={`handlebars-textarea-wrapper ${className || ''}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={hasError ? 'template-error' : ''}
      />
      {hasError && (
        <div className="template-error-message">
          <span className="error-icon">⚠</span>
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};

export default HandlebarsTextarea;
