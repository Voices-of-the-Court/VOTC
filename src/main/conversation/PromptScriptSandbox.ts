/**
 * PromptScriptSandbox - Secure execution environment for user-defined prompt scripts
 * 
 * Uses Node.js VM module to create an isolated context where:
 * - Dangerous globals (require, process, etc.) are blocked
 * - Scripts can still access gameData and currentCharacterId
 * - Standard JavaScript features work normally
 * 
 * Supports three script types:
 * - Description scripts (pList): Return string
 * - Example scripts (aliChat): Return array of messages
 * - Helper scripts: Register Handlebars helpers
 */

import * as vm from 'vm';
import * as fs from 'fs';

export interface DescriptionContext {
  gameData: any;
  currentCharacterId?: number;
}

export interface ExampleContext {
  gameData: any;
  currentCharacterId?: number;
}

export interface HelperContext {
  Handlebars: any;
}

export class PromptScriptSandbox {
  /**
   * Execute a description script (pList) in a sandboxed VM context
   * Expected to return a string
   */
  static executeDescription(
    scriptFilePath: string,
    context: DescriptionContext
  ): string {
    const scriptCode = fs.readFileSync(scriptFilePath, 'utf-8');
    
    const sandbox = this.createBaseSandbox();
    sandbox.gameData = context.gameData;
    sandbox.currentCharacterId = context.currentCharacterId;
    
    const result = this.executeScript(scriptFilePath, scriptCode, sandbox, 'description');
    return result as string;
  }

  /**
   * Execute an example script (aliChat) in a sandboxed VM context
   * Expected to return an array of message objects
   */
  static executeExamples(
    scriptFilePath: string,
    context: ExampleContext
  ): any[] {
    const scriptCode = fs.readFileSync(scriptFilePath, 'utf-8');
    
    const sandbox = this.createBaseSandbox();
    sandbox.gameData = context.gameData;
    sandbox.currentCharacterId = context.currentCharacterId;
    
    const result = this.executeScript(scriptFilePath, scriptCode, sandbox, 'examples');
    return Array.isArray(result) ? result : [];
  }

  /**
   * Execute a helper script in a sandboxed VM context
   * Helper scripts register Handlebars helpers
   */
  static executeHelper(
    scriptFilePath: string,
    Handlebars: any
  ): void {
    const scriptCode = fs.readFileSync(scriptFilePath, 'utf-8');
    
    const sandbox = this.createBaseSandbox();
    sandbox.Handlebars = Handlebars;
    
    this.executeScript(scriptFilePath, scriptCode, sandbox, 'helper');
  }

  /**
   * Create the base sandbox with safe globals
   */
  private static createBaseSandbox(): any {
    return {
      // Safe JavaScript globals
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Promise: Promise,
      
      // Standard constructors
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      Math: Math,
      JSON: JSON,
      RegExp: RegExp,
      Error: Error,
      Map: Map,
      Set: Set,
      WeakMap: WeakMap,
      WeakSet: WeakSet,
      
      // Typed arrays (useful for data processing)
      Int8Array: Int8Array,
      Uint8Array: Uint8Array,
      Uint8ClampedArray: Uint8ClampedArray,
      Int16Array: Int16Array,
      Uint16Array: Uint16Array,
      Int32Array: Int32Array,
      Uint32Array: Uint32Array,
      Float32Array: Float32Array,
      Float64Array: Float64Array,
      
      // Block dangerous globals explicitly
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
      eval: undefined,
      Function: undefined,
      Buffer: undefined,
      module: undefined,
      exports: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
  }

  /**
   * Execute script in VM context with appropriate wrapper
   * Synchronous execution for compatibility with existing API
   */
  private static executeScript(
    filePath: string,
    scriptCode: string,
    sandbox: any,
    scriptType: 'description' | 'examples' | 'helper'
  ): any {
    // Create VM context
    const vmContext = vm.createContext(sandbox);
    
    // Wrap the script code to extract and execute the exported function
    // Use synchronous wrapper since the scripts themselves are synchronous
    const wrapperCode = `
      (function() {
        // Create a module-like structure for CommonJS style exports
        const module = { exports: {} };
        const exports = module.exports;
        
        // Execute the script code to populate module.exports
        ${scriptCode}
        
        // Get the exported function (support both module.exports and default export)
        const exportedFn = module.exports && module.exports.default 
          ? module.exports.default 
          : module.exports;
        
        if (typeof exportedFn !== 'function') {
          throw new Error('Script must export a function');
        }
        
        // Execute based on script type
        ${this.getExecutionCode(scriptType)}
      })();
    `;
    
    try {
      const script = new vm.Script(wrapperCode, {
        filename: filePath,
      });
      
      const result = script.runInContext(vmContext, {
        displayErrors: true,
        breakOnSigint: true
      });
      
      // Validate result type
      if (scriptType === 'description' && typeof result !== 'string') {
        throw new Error(`Description script must return a string, got ${typeof result}`);
      }
      if (scriptType === 'examples' && !Array.isArray(result)) {
        throw new Error(`Example script must return an array, got ${typeof result}`);
      }
      
      return result;
    } catch (error) {
      console.error('[PromptScriptSandbox] Execution error:', error);
      throw new Error(`Script execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the execution code based on script type
   */
  private static getExecutionCode(scriptType: 'description' | 'examples' | 'helper'): string {
    switch (scriptType) {
      case 'description':
      case 'examples':
        return `
          const result = exportedFn(gameData, currentCharacterId);
          return result;
        `;
      case 'helper':
        return `
          exportedFn(Handlebars);
          return undefined;
        `;
    }
  }
}