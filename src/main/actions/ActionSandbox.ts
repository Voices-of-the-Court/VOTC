/**
 * ActionSandbox - Secure execution environment for user-defined actions
 * 
 * Uses Node.js VM module to create an isolated context where:
 * - Dangerous globals (require, process, etc.) are blocked
 * - Actions can still access and modify gameData, characters, and conversation
 * - Standard JavaScript features work normally
 */

import * as vm from 'vm';
import * as fs from 'fs';

export interface SandboxContext {
  gameData: any;
  sourceCharacter: any;
  targetCharacter?: any;
  runGameEffect: (effectBody: string) => void;
  args: Record<string, any>;
  conversation?: any;
  dryRun?: boolean;
  lang?: string;
}

export class ActionSandbox {
  /**
   * Load and execute an action in a sandboxed VM context
   */
  static async executeAction(
    actionFilePath: string,
    context: SandboxContext
  ): Promise<any> {
    // Read the action file
    const actionCode = fs.readFileSync(actionFilePath, 'utf-8');
    
    // Create the sandbox context with safe globals
    const sandbox: any = {
      // Provide the context objects (these are references, so modifications work)
      gameData: context.gameData,
      sourceCharacter: context.sourceCharacter,
      targetCharacter: context.targetCharacter,
      runGameEffect: context.runGameEffect,
      args: context.args,
      conversation: context.conversation,
      dryRun: context.dryRun,
      lang: context.lang,
      
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
    
    // Create VM context
    const vmContext = vm.createContext(sandbox);
    
    // Wrap the action code to extract and execute the run function
    const wrapperCode = `
      (async function() {
        // Create a module-like structure
        const module = { exports: {} };
        const exports = module.exports;
        
        // Execute the action code to populate module.exports
        ${actionCode}
        
        // Get the action definition
        const actionDef = module.exports;
        
        if (!actionDef || typeof actionDef.run !== 'function') {
          throw new Error('Action must export an object with a run function');
        }
        
        // Execute the run function with the context
        const result = await actionDef.run({
          gameData,
          sourceCharacter,
          targetCharacter,
          runGameEffect,
          args,
          conversation,
          dryRun,
          lang
        });
        
        return result;
      })();
    `;
    
    try {
      // Execute in VM context
      const script = new vm.Script(wrapperCode, {
        filename: actionFilePath,
      });
      
      const result = await script.runInContext(vmContext, {
        displayErrors: true,
        breakOnSigint: true
      });
      
      return result;
    } catch (error) {
      console.error('[ActionSandbox] Execution error:', error);
      throw new Error(`Action execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
