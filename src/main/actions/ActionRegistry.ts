import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { EventEmitter } from "events";
import { app } from "electron";

import {
  ActionDefinition,
  ActionArgumentDefinition,
  ActionInvocation,
} from "./types";
import { VOTC_ACTIONS_DIR, VOTC_DATA_DIR } from "../utils/paths";
import {
  ActionSettings,
  ActionValidationStatus,
} from "../llmProviders/types";

const STANDARD_SUBDIR = "standard";
const CUSTOM_SUBDIR = "custom";
const DEFAULT_USERDATA_DIR = path.join(app.getAppPath(), 'default_userdata', 'actions');

export type ActionSource = "standard" | "custom";

export interface LoadedAction {
  definition: ActionDefinition;
  id: string;
  scope: ActionSource;
  filePath: string;
  validation: ActionValidationStatus;
}

export interface ActionRegistryEvents {
  "actions-reloaded": LoadedAction[];
}

type ActionRegistryEventNames = keyof ActionRegistryEvents;

export class ActionRegistry extends EventEmitter {
  private static instance: ActionRegistry;

  private actions: Map<string, LoadedAction> = new Map();
  private settings: ActionSettings = {
    disabledActions: [],
    validation: {},
  };

  private constructor() {
    super();
  }

  public static getInstance(): ActionRegistry {
    if (!ActionRegistry.instance) {
      ActionRegistry.instance = new ActionRegistry();
    }
    return ActionRegistry.instance;
  }

  public setSettings(settings: ActionSettings | undefined): void {
    if (!settings) {
      this.settings = { disabledActions: [], validation: {}, destructiveOverrides: {} };
      return;
    }
    this.settings = {
      ...settings,
      destructiveOverrides: settings.destructiveOverrides || {},
    };
  }

  public getSettings(): ActionSettings {
    return this.settings;
  }

  public getAllActions(includeDisabled = false): LoadedAction[] {
    const disabled = new Set(this.settings.disabledActions);
    return Array.from(this.actions.values()).filter((action) => {
      if (includeDisabled) {
        return true;
      }
      return !disabled.has(action.id) && action.validation.valid;
    });
  }

  public isActionDisabled(signature: string): boolean {
    return this.settings.disabledActions.includes(signature);
  }

  public getValidationStatus(signature: string): ActionValidationStatus {
    return (
      this.settings.validation[signature] ?? {
        valid: this.actions.has(signature),
      }
    );
  }

  public setActionDisabled(signature: string, disabled: boolean): void {
    const current = new Set(this.settings.disabledActions);
    if (disabled) {
      current.add(signature);
    } else {
      current.delete(signature);
    }
    this.settings = {
      ...this.settings,
      disabledActions: Array.from(current),
    };
  }

  public setDestructiveOverride(signature: string, isDestructive: boolean | null): void {
    const overrides = { ...this.settings.destructiveOverrides };
    if (isDestructive === null) {
      // Remove override, revert to default
      delete overrides[signature];
    } else {
      overrides[signature] = isDestructive;
    }
    this.settings = {
      ...this.settings,
      destructiveOverrides: overrides,
    };
  }

  public getEffectiveDestructive(signature: string): boolean {
    const action = this.actions.get(signature);
    if (!action) return false;
    
    // Check if there's an override
    if (this.settings.destructiveOverrides && signature in this.settings.destructiveOverrides) {
      return this.settings.destructiveOverrides[signature];
    }
    
    // Return the action's default isDestructive value
    return action.definition.isDestructive ?? false;
  }

  public hasDestructiveOverride(signature: string): boolean {
    return !!(this.settings.destructiveOverrides && signature in this.settings.destructiveOverrides);
  }

  public registerValidation(
    signature: string,
    status: ActionValidationStatus
  ): void {
    this.settings = {
      ...this.settings,
      validation: {
        ...this.settings.validation,
        [signature]: status,
      },
    };
  }

  public getById(signature: string): LoadedAction | undefined {
    return this.actions.get(signature);
  }

  public async reloadActions(): Promise<void> {
    this.actions.clear();
    this.settings.validation = {};
    await this.ensureBaseStructure();
    await this.seedDefaults(); // Ensure default actions are copied
    const loaded: LoadedAction[] = [];
    const standardActions = await this.loadDirectory(STANDARD_SUBDIR, "standard");
    const customActions = await this.loadDirectory(CUSTOM_SUBDIR, "custom");
    for (const action of [...standardActions, ...customActions]) {
      this.actions.set(action.id, action);
      loaded.push(action);
    }
    this.emit("actions-reloaded", loaded);
  }

  public on<EventName extends ActionRegistryEventNames>(
    event: EventName,
    listener: (payload: ActionRegistryEvents[EventName]) => void
  ): this {
    return super.on(event, listener);
  }

  private async ensureBaseStructure(): Promise<void> {
    await fs.promises.mkdir(VOTC_ACTIONS_DIR, { recursive: true });
    await fs.promises.mkdir(
      path.join(VOTC_ACTIONS_DIR, STANDARD_SUBDIR),
      { recursive: true }
    );
    await fs.promises.mkdir(
      path.join(VOTC_ACTIONS_DIR, CUSTOM_SUBDIR),
      { recursive: true }
    );
  }

  /**
   * Copy default action files into user data, always updating existing files.
   */
  public async seedDefaults(): Promise<void> {
    await this.ensureBaseStructure();
    
    if (!fs.existsSync(DEFAULT_USERDATA_DIR)) {
      return;
    }

    const copyRecursive = (src: string, dest: string) => {
      if (!fs.existsSync(src)) return;
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
          copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
      } else {
        fs.copyFileSync(src, dest);
      }
    };

    const defaultStandardDir = path.join(DEFAULT_USERDATA_DIR, STANDARD_SUBDIR);
    const userStandardDir = path.join(VOTC_ACTIONS_DIR, STANDARD_SUBDIR);
    
    if (fs.existsSync(defaultStandardDir)) {
      copyRecursive(defaultStandardDir, userStandardDir);
    }

    // Copy gamedata_typedefs.js to user data directory
    const defaultTypeDefsPath = path.join(path.dirname(DEFAULT_USERDATA_DIR), 'gamedata_typedefs.js');
    const userTypeDefsPath = path.join(VOTC_DATA_DIR, 'gamedata_typedefs.js');
    
    if (fs.existsSync(defaultTypeDefsPath)) {
      fs.copyFileSync(defaultTypeDefsPath, userTypeDefsPath);
    }
  }

  private async loadDirectory(
    subdir: string,
    scope: ActionSource
  ): Promise<LoadedAction[]> {
    const dirPath = path.join(VOTC_ACTIONS_DIR, subdir);
    const files = await fs.promises.readdir(dirPath);
    const loaded: LoadedAction[] = [];

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) {
        continue;
      }
      const ext = path.extname(fullPath).toLowerCase();
      if (![".js", ".cjs", ".mjs"].includes(ext)) {
        continue;
      }

      const result = await this.importAction(fullPath, scope);
      if (result) {
        loaded.push(result);
      }
    }

    return loaded;
  }

  private async importAction(
    filePath: string,
    scope: ActionSource
  ): Promise<LoadedAction | null> {
    try {
      // Load action definition using VM sandbox for security
      // This validates the action structure without executing it
      const actionDef = await this.loadActionDefinition(filePath);
      
      const validation = this.validateCandidate(actionDef);
      const id = actionDef?.signature ?? path.basename(filePath);
      this.registerValidation(id, validation);

      return {
        definition: actionDef as ActionDefinition,
        id,
        scope,
        filePath,
        validation,
      };
    } catch (error) {
      const id = path.basename(filePath);
      const errorMessage = (error as Error).message;
      
      const validation: ActionValidationStatus = {
        valid: false,
        message: `Failed to load action: ${errorMessage}`,
      };
      this.registerValidation(id, validation);
      
      return {
        definition: {} as ActionDefinition,
        id,
        scope,
        filePath,
        validation,
      };
    }
  }

  /**
   * Load action definition from file using VM sandbox
   */
  private async loadActionDefinition(filePath: string): Promise<any> {
    const actionCode = await fs.promises.readFile(filePath, 'utf-8');
    
    // Create a minimal sandbox just for loading the definition
    const sandbox: any = {
      module: { exports: {} },
      exports: {},
      console: console,
      
      // Block dangerous globals
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
      eval: undefined,
      Function: undefined,
      Buffer: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
    
    const vm = require('vm');
    const vmContext = vm.createContext(sandbox);
    
    try {
      // Execute the action code to populate module.exports
      const script = new vm.Script(actionCode, {
        filename: filePath,
      });
      
      script.runInContext(vmContext);
      
      return sandbox.module.exports;
    } catch (error) {
      throw new Error(`Failed to parse action: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateCandidate(candidate: unknown): ActionValidationStatus {
    if (!candidate || typeof candidate !== "object") {
      return {
        valid: false,
        message: "Action module must export an object.",
      };
    }

    const action = candidate as ActionDefinition;

    if (typeof action.signature !== "string" || action.signature.length === 0) {
      return {
        valid: false,
        message: "Action must define a non-empty string signature.",
      };
    }

    if (!(typeof action.description === "string" || typeof (action as any).description === "function")) {
      return {
        valid: false,
        message: "Action must include a description string or description(context) function.",
      };
    }

    if (!Array.isArray(action.args) && typeof (action as any).args !== "function") {
      return {
        valid: false,
        message: "Action args must be an array or args(context) function.",
      };
    }

    if (Array.isArray(action.args)) {
      const argsValidation = this.validateArguments(action.args);
      if (!argsValidation.valid) {
        return argsValidation;
      }
    }

    if (typeof action.check !== "function") {
      return {
        valid: false,
        message: "Action must provide a check(context) function.",
      };
    }

    if (typeof action.run !== "function") {
      return {
        valid: false,
        message: "Action must provide a run(context) function.",
      };
    }

    return { valid: true };
  }

  private validateArguments(args: ActionArgumentDefinition[]): ActionValidationStatus {
    for (const arg of args) {
      if (typeof arg.name !== "string" || arg.name.length === 0) {
        return {
          valid: false,
          message: "Action argument must include a non-empty name.",
        };
      }
      if (typeof arg.description !== "string") {
        return {
          valid: false,
          message: `Argument '${arg.name}' must include a description.`,
        };
      }

      if (arg.type === "number") {
        if (arg.min !== undefined && typeof arg.min !== "number") {
          return {
            valid: false,
            message: `Argument '${arg.name}' has invalid min value.`,
          };
        }
        if (arg.max !== undefined && typeof arg.max !== "number") {
          return {
            valid: false,
            message: `Argument '${arg.name}' has invalid max value.`,
          };
        }
      } else if (arg.type === "string") {
        if (
          "pattern" in arg &&
          arg.pattern !== undefined &&
          !(typeof arg.pattern === "string" || arg.pattern instanceof RegExp)
        ) {
          return {
            valid: false,
            message: `Argument '${arg.name}' has invalid pattern.`,
          };
        }
      } else if (arg.type === "enum") {
        if (
          !Array.isArray(arg.options) ||
          arg.options.length === 0 ||
          arg.options.some((opt) => typeof opt !== "string")
        ) {
          return {
            valid: false,
            message: `Argument '${arg.name}' enum must provide non-empty string options.`,
          };
        }
      } else if (arg.type === "boolean") {
        // Boolean type has no additional validation requirements
      } else {
        const exhaustiveCheck: never = arg;
        return {
          valid: false,
          message: `Argument '${(exhaustiveCheck as { name?: string }).name ?? "unknown"}' has unsupported type.`,
        };
      }
    }
    return { valid: true };
  }
}

export const actionRegistry = ActionRegistry.getInstance();

export function isActionInvocation(value: unknown): value is ActionInvocation {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as ActionInvocation;
  if (typeof candidate.actionId !== "string") {
    return false;
  }
  if (
    candidate.targetCharacterId !== undefined &&
    candidate.targetCharacterId !== null &&
    typeof candidate.targetCharacterId !== "number"
  ) {
    return false;
  }
  if (
    candidate.args !== undefined &&
    (typeof candidate.args !== "object" || Array.isArray(candidate.args))
  ) {
    return false;
  }
  return true;
}