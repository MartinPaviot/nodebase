// src/base.ts
import {
  ConnectorError
} from "@nodebase/types";
var BaseConnector = class {
  // Actions and triggers
  actions = /* @__PURE__ */ new Map();
  triggers = /* @__PURE__ */ new Map();
  /**
   * Register an action.
   */
  registerAction(action) {
    this.actions.set(action.id, action);
  }
  /**
   * Register a trigger.
   */
  registerTrigger(trigger) {
    this.triggers.set(trigger.id, trigger);
  }
  /**
   * Get all actions.
   */
  getActions() {
    return Array.from(this.actions.values());
  }
  /**
   * Get all triggers.
   */
  getTriggers() {
    return Array.from(this.triggers.values());
  }
  /**
   * Get an action by ID.
   */
  getAction(actionId) {
    return this.actions.get(actionId);
  }
  /**
   * Get a trigger by ID.
   */
  getTrigger(triggerId) {
    return this.triggers.get(triggerId);
  }
  /**
   * Execute an action.
   */
  async executeAction(actionId, input, context) {
    const action = this.actions.get(actionId);
    if (!action) {
      return {
        success: false,
        error: `Action ${actionId} not found on connector ${this.id}`
      };
    }
    const parseResult = action.inputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid input: ${parseResult.error.message}`
      };
    }
    try {
      const result = await action.execute(parseResult.data, context);
      return result;
    } catch (error) {
      throw new ConnectorError(
        this.id,
        actionId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  /**
   * Get connector config for display.
   */
  toConfig() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      provider: this.id,
      pipedreamAppSlug: this.pipedreamAppSlug,
      requiredScopes: this.requiredScopes,
      optionalScopes: this.optionalScopes
    };
  }
};

export {
  BaseConnector
};
