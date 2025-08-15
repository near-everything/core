// =============================================================================
// ENHANCED PLUGIN SERVICE IMPLEMENTATION
// =============================================================================

import type { Config, Plugin, PluginExecutionError, PluginMetadata } from "@usersdotfun/core-sdk";
import { ConfigurationError, PluginLoggerTag } from "@usersdotfun/core-sdk";
import { Cache, Context, Duration, Effect, Layer, Schedule } from "effect";
import type z from "zod";
import registryData from "../../../registry-builder/registry.json" with { type: "json" };
import { PluginError } from "../pipeline/errors";
import { SchemaValidator } from "../pipeline/validation";
import { EnvironmentServiceTag } from "./environment.service";
import { ModuleFederationTag } from "./mf.service";

// =============================================================================
// ENHANCED INTERFACES
// =============================================================================

interface ExecutionOptions {
  timeout?: Duration;
  retryPolicy?: Schedule.Schedule<unknown, unknown>;
  circuitBreakerConfig?: CircuitBreakerConfig;
  enableMetrics?: boolean; // defaults to true
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: Duration;
  halfOpenMaxCalls: number;
}

interface PluginMetrics {
  executionCount: number;
  errorCount: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
  successRate: number;
}

interface PluginHealth {
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: Date;
  circuitBreakerState?: "closed" | "open" | "half-open";
  details?: Record<string, unknown>;
}

// =============================================================================
// SECURITY SERVICE
// =============================================================================

export class SecurityServiceTag extends Context.Tag("SecurityService")<
  SecurityServiceTag,
  SecurityService
>() {}

interface SecurityService {
  readonly validate: <T>(data: T) => Effect.Effect<T, SecurityViolationError>;
}

class SecurityViolationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SecurityViolationError";
  }
}

const SecurityServiceLive = Layer.succeed(
  SecurityServiceTag,
  {
    validate: <T>(data: T): Effect.Effect<T, SecurityViolationError> =>
      Effect.gen(function* () {
        // Deep freeze the object to prevent mutations
        const frozenData = deepFreeze(data);
        
        // Check for prototype pollution
        yield* validateNoPrototypePollution(frozenData);
        
        return frozenData;
      })
  }
);

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Freeze the object itself
  Object.freeze(obj);

  // Recursively freeze all properties
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value !== null && typeof value === "object") {
      deepFreeze(value);
    }
  });

  return obj;
}

function validateNoPrototypePollution<T>(obj: T): Effect.Effect<void, SecurityViolationError> {
  return Effect.gen(function* () {
    if (typeof obj !== "object" || obj === null) {
      return;
    }

    const dangerousKeys = ["__proto__", "constructor", "prototype"];
    
    function checkObject(current: any, path: string = ""): void {
      if (typeof current !== "object" || current === null) {
        return;
      }

      for (const key of Object.keys(current)) {
        if (dangerousKeys.includes(key)) {
          throw new SecurityViolationError(
            `Prototype pollution attempt detected at path: ${path}.${key}`
          );
        }
        
        checkObject(current[key], path ? `${path}.${key}` : key);
      }
    }

    try {
      checkObject(obj);
    } catch (error) {
      if (error instanceof SecurityViolationError) {
        return yield* Effect.fail(error);
      }
      return yield* Effect.fail(new SecurityViolationError(`Security validation failed: ${error}`));
    }
  });
}

// =============================================================================
// METRICS SERVICE
// =============================================================================

export class MetricsServiceTag extends Context.Tag("MetricsService")<
  MetricsServiceTag,
  MetricsService
>() {}

interface MetricsService {
  readonly recordPluginExecution: (pluginId: string, duration: number, success: boolean) => Effect.Effect<void>;
  readonly recordPluginError: (pluginId: string, error: PluginError) => Effect.Effect<void>;
  readonly getPluginMetrics: (pluginId: string) => Effect.Effect<PluginMetrics>;
  readonly getSystemMetrics: () => Effect.Effect<Record<string, PluginMetrics>>;
}

const MetricsServiceLive = Layer.effect(
  MetricsServiceTag,
  Effect.gen(function* () {
    // In-memory metrics storage (could be replaced with Redis/DB)
    const metricsStore = new Map<string, {
      executionCount: number;
      errorCount: number;
      totalExecutionTime: number;
      lastExecutionTime?: Date;
    }>();

    return {
      recordPluginExecution: (pluginId: string, duration: number, success: boolean) =>
        Effect.sync(() => {
          const current = metricsStore.get(pluginId) || {
            executionCount: 0,
            errorCount: 0,
            totalExecutionTime: 0
          };

          metricsStore.set(pluginId, {
            executionCount: current.executionCount + 1,
            errorCount: success ? current.errorCount : current.errorCount + 1,
            totalExecutionTime: current.totalExecutionTime + duration,
            lastExecutionTime: new Date()
          });
        }),

      recordPluginError: (pluginId: string, error: PluginError) =>
        Effect.sync(() => {
          const current = metricsStore.get(pluginId) || {
            executionCount: 0,
            errorCount: 0,
            totalExecutionTime: 0
          };

          metricsStore.set(pluginId, {
            ...current,
            errorCount: current.errorCount + 1
          });
        }),

      getPluginMetrics: (pluginId: string) =>
        Effect.sync(() => {
          const metrics = metricsStore.get(pluginId);
          if (!metrics) {
            return {
              executionCount: 0,
              errorCount: 0,
              averageExecutionTime: 0,
              successRate: 0
            };
          }

          return {
            executionCount: metrics.executionCount,
            errorCount: metrics.errorCount,
            averageExecutionTime: metrics.executionCount > 0 
              ? metrics.totalExecutionTime / metrics.executionCount 
              : 0,
            lastExecutionTime: metrics.lastExecutionTime,
            successRate: metrics.executionCount > 0 
              ? (metrics.executionCount - metrics.errorCount) / metrics.executionCount 
              : 0
          };
        }),

      getSystemMetrics: () =>
        Effect.sync(() => {
          const systemMetrics: Record<string, PluginMetrics> = {};
          for (const [pluginId] of metricsStore) {
            const metrics = metricsStore.get(pluginId)!;
            systemMetrics[pluginId] = {
              executionCount: metrics.executionCount,
              errorCount: metrics.errorCount,
              averageExecutionTime: metrics.executionCount > 0 
                ? metrics.totalExecutionTime / metrics.executionCount 
                : 0,
              lastExecutionTime: metrics.lastExecutionTime,
              successRate: metrics.executionCount > 0 
                ? (metrics.executionCount - metrics.errorCount) / metrics.executionCount 
                : 0
            };
          }
          return systemMetrics;
        })
    };
  })
);

// =============================================================================
// CIRCUIT BREAKER SERVICE
// =============================================================================

export class CircuitBreakerServiceTag extends Context.Tag("CircuitBreakerService")<
  CircuitBreakerServiceTag,
  CircuitBreakerService
>() {}

interface CircuitBreakerService {
  readonly executeWithCircuitBreaker: <T>(
    key: string, 
    effect: Effect.Effect<T>, 
    config: CircuitBreakerConfig
  ) => Effect.Effect<T>;
  readonly getCircuitBreakerState: (key: string) => Effect.Effect<"closed" | "open" | "half-open">;
}

const CircuitBreakerServiceLive = Layer.effect(
  CircuitBreakerServiceTag,
  Effect.gen(function* () {
    // Simple in-memory circuit breaker state
    const circuitStates = new Map<string, {
      state: "closed" | "open" | "half-open";
      failureCount: number;
      lastFailureTime?: Date;
      halfOpenCalls: number;
    }>();

    return {
      executeWithCircuitBreaker: <T>(
        key: string, 
        effect: Effect.Effect<T>, 
        config: CircuitBreakerConfig
      ) =>
        Effect.gen(function* () {
          const state = circuitStates.get(key) || {
            state: "closed" as const,
            failureCount: 0,
            halfOpenCalls: 0
          };

          // Check if circuit should transition from open to half-open
          if (state.state === "open" && state.lastFailureTime) {
            const timeSinceFailure = Date.now() - state.lastFailureTime.getTime();
            if (timeSinceFailure >= config.resetTimeout.millis) {
              state.state = "half-open";
              state.halfOpenCalls = 0;
            }
          }

          // Reject if circuit is open
          if (state.state === "open") {
            return yield* Effect.fail(new Error("Circuit breaker is open"));
          }

          // Limit calls in half-open state
          if (state.state === "half-open" && state.halfOpenCalls >= config.halfOpenMaxCalls) {
            return yield* Effect.fail(new Error("Circuit breaker half-open call limit exceeded"));
          }

          try {
            const result = yield* effect;
            
            // Success - reset failure count or close circuit
            if (state.state === "half-open") {
              state.state = "closed";
              state.failureCount = 0;
              state.halfOpenCalls = 0;
            } else {
              state.failureCount = Math.max(0, state.failureCount - 1);
            }
            
            circuitStates.set(key, state);
            return result;
          } catch (error) {
            // Failure - increment counters
            state.failureCount++;
            state.lastFailureTime = new Date();
            
            if (state.state === "half-open") {
              state.state = "open";
            } else if (state.failureCount >= config.failureThreshold) {
              state.state = "open";
            }
            
            if (state.state === "half-open") {
              state.halfOpenCalls++;
            }
            
            circuitStates.set(key, state);
            throw error;
          }
        }),

      getCircuitBreakerState: (key: string) =>
        Effect.sync(() => {
          const state = circuitStates.get(key);
          return state?.state || "closed";
        })
    };
  })
);

// =============================================================================
// ENHANCED PLUGIN SERVICE
// =============================================================================

interface EnhancedPluginService {
  readonly initializePlugin: <T extends Plugin<z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny>>(
    pluginConfig: { pluginId: string; config: z.ZodTypeAny; },
    contextDescription: string,
  ) => Effect.Effect<T, PluginError>;

  readonly executePlugin: <TInputSchema extends z.ZodTypeAny,
    TOutputSchema extends z.ZodTypeAny,
    TConfigSchema extends z.ZodTypeAny>(
      plugin: Plugin<TInputSchema, TOutputSchema, TConfigSchema>,
      input: z.infer<TInputSchema>,
      contextDescription: string,
      options?: ExecutionOptions
    ) => Effect.Effect<z.infer<TOutputSchema>, PluginError>;

  readonly getPluginMetrics: (pluginId: string) => Effect.Effect<PluginMetrics>;
  readonly getPluginHealth: (pluginId: string) => Effect.Effect<PluginHealth>;
}

export class EnhancedPluginServiceTag extends Context.Tag("EnhancedPluginService")<
  EnhancedPluginServiceTag,
  EnhancedPluginService
>() {}

// Default execution options
const defaultExecutionOptions: Required<ExecutionOptions> = {
  timeout: Duration.seconds(30),
  retryPolicy: Schedule.exponential(Duration.millis(100)).pipe(
    Schedule.intersect(Schedule.recurs(2))
  ),
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeout: Duration.minutes(1),
    halfOpenMaxCalls: 3
  },
  enableMetrics: true
};

export const EnhancedPluginServiceLive = Layer.effect(
  EnhancedPluginServiceTag,
  Effect.gen(function* () {
    const moduleCache = yield* createPluginCache();
    const environmentService = yield* EnvironmentServiceTag;
    const logger = yield* PluginLoggerTag;
    const securityService = yield* SecurityServiceTag;
    const metricsService = yield* MetricsServiceTag;
    const circuitBreakerService = yield* CircuitBreakerServiceTag;

    // ... existing loadAndInstantiate logic from original service ...

    return {
      initializePlugin: <T extends Plugin<any, any, any>>(
        pluginConfig: { pluginId: string; config: any; },
        contextDescription: string,
      ): Effect.Effect<T, PluginError> => {
        // ... existing initialization logic ...
        return Effect.succeed({} as T); // Placeholder
      },

      executePlugin: <TInputSchema extends z.ZodTypeAny,
        TOutputSchema extends z.ZodTypeAny,
        TConfigSchema extends z.ZodTypeAny>(
          plugin: Plugin<TInputSchema, TOutputSchema, TConfigSchema>,
          input: z.infer<TInputSchema>,
          contextDescription: string,
          options: ExecutionOptions = {}
        ): Effect.Effect<z.infer<TOutputSchema>, PluginError> => Effect.gen(function* () {
          const opts = { ...defaultExecutionOptions, ...options };
          const startTime = Date.now();

          yield* logger.logDebug(`Executing plugin ${plugin.id}`, { contextDescription });

          const pluginMetadata = yield* getPlugin(plugin.id);

          // 1. Validate and secure input
          const validatedInput = yield* SchemaValidator.validate(
            pluginMetadata.inputSchema,
            input as Record<string, unknown>,
            `${contextDescription} input`
          ).pipe(
            Effect.mapError((validationError) => new PluginError({
              message: `Input validation failed: ${validationError.message}`,
              pluginId: plugin.id,
              operation: "validate",
              cause: validationError,
              retryable: false
            }))
          );

          const secureInput = yield* securityService.validate(validatedInput).pipe(
            Effect.mapError((securityError) => new PluginError({
              message: `Input security validation failed: ${securityError.message}`,
              pluginId: plugin.id,
              operation: "security-validate",
              cause: securityError,
              retryable: false
            }))
          );

          // 2. Execute plugin with all enhancements
          const pluginLayer = Layer.succeed(PluginLoggerTag, logger);

          const executeWithEnhancements = plugin.execute(secureInput as z.infer<TInputSchema>).pipe(
            Effect.provide(pluginLayer),
            Effect.timeout(opts.timeout),
            Effect.retry(opts.retryPolicy.pipe(
              Schedule.whileInput((error: any) => {
                if (error instanceof PluginExecutionError) {
                  return error.retryable ?? false;
                }
                return false;
              })
            )),
            Effect.mapError((error: PluginExecutionError) => new PluginError({
              message: `Plugin execution failed: ${error.message}`,
              pluginId: plugin.id,
              operation: "execute",
              cause: error,
              retryable: error.retryable,
            }))
          );

          const output = yield* circuitBreakerService.executeWithCircuitBreaker(
            `plugin-${plugin.id}`,
            executeWithEnhancements,
            opts.circuitBreakerConfig
          ).pipe(
            Effect.mapError((error) => new PluginError({
              message: `Circuit breaker error: ${error.message}`,
              pluginId: plugin.id,
              operation: "circuit-breaker",
              cause: error,
              retryable: true
            }))
          );

          // 3. Validate and secure output
          const validatedOutput = yield* SchemaValidator.validate(
            pluginMetadata.outputSchema,
            output as Record<string, unknown>,
            `${contextDescription} output`
          ).pipe(
            Effect.mapError((validationError) => new PluginError({
              message: `Output validation failed: ${validationError.message}`,
              pluginId: plugin.id,
              operation: "validate",
              cause: validationError,
              retryable: false
            }))
          );

          const secureOutput = yield* securityService.validate(validatedOutput).pipe(
            Effect.mapError((securityError) => new PluginError({
              message: `Output security validation failed: ${securityError.message}`,
              pluginId: plugin.id,
              operation: "security-validate",
              cause: securityError,
              retryable: false
            }))
          );

          // 4. Record metrics
          if (opts.enableMetrics) {
            const duration = Date.now() - startTime;
            yield* metricsService.recordPluginExecution(plugin.id, duration, true);
          }

          yield* logger.logInfo(`Successfully executed plugin ${plugin.id}`, {
            contextDescription,
            executionTime: Date.now() - startTime,
            outputSize: JSON.stringify(secureOutput).length
          });

          return secureOutput as z.infer<TOutputSchema>;
        }).pipe(
          Effect.catchAll((error: PluginError) =>
            Effect.gen(function* () {
              const duration = Date.now() - startTime;
              if (options.enableMetrics !== false) {
                yield* metricsService.recordPluginExecution(plugin.id, duration, false);
                yield* metricsService.recordPluginError(plugin.id, error);
              }
              return yield* Effect.fail(error);
            })
          )
        ),

      getPluginMetrics: (pluginId: string) => metricsService.getPluginMetrics(pluginId),

      getPluginHealth: (pluginId: string) =>
        Effect.gen(function* () {
          const metrics = yield* metricsService.getPluginMetrics(pluginId);
          const circuitState = yield* circuitBreakerService.getCircuitBreakerState(`plugin-${pluginId}`);
          
          let status: "healthy" | "degraded" | "unhealthy" = "healthy";
          if (circuitState === "open") {
            status = "unhealthy";
          } else if (metrics.successRate < 0.9 || circuitState === "half-open") {
            status = "degraded";
          }

          return {
            status,
            lastCheck: new Date(),
            circuitBreakerState: circuitState,
            details: {
              successRate: metrics.successRate,
              executionCount: metrics.executionCount,
              errorCount: metrics.errorCount,
              averageExecutionTime: metrics.averageExecutionTime
            }
          };
        })
    };
  })
).pipe(
  Layer.provide(SecurityServiceLive),
  Layer.provide(MetricsServiceLive),
  Layer.provide(CircuitBreakerServiceLive)
);

// =============================================================================
// RISKS IN ENHANCED RSS PLUGIN & RESOURCE CLEANUP
// =============================================================================

/*
CURRENT RISKS IN RSS PLUGIN:

1. **XMLParser Instance**: The XMLParser is created once in constructor but never cleaned up
   - Risk: Memory leak if parser holds internal state
   - Fix: Set parser to null in shutdown()

2. **AbortSignal.timeout()**: Creates timeout that may not be cleaned up properly
   - Risk: Potential timer leak
   - Fix: Use AbortController with manual cleanup

3. **Fetch Response**: Response streams may not be fully consumed
   - Risk: Connection leaks
   - Fix: Ensure response.text() completes or handle cleanup

4. **Config Reference**: Holds reference to config object
   - Risk: Memory leak if config contains large objects
   - Fix: Already handled (set to null in shutdown)

RECOMMENDED RESOURCE CLEANUP:

```typescript
shutdown(): Effect.Effect<void, never, PluginLoggerTag> {
  const self = this;
  return Effect.gen(function* () {
    const logger = yield* PluginLoggerTag;
    yield* logger.logInfo('Shutting down RSS source plugin');
    
    // Clean
