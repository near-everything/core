# Plugin Standardization Implementation Plan

## Overview

Standardize and enhance the curate.fun plugin system to provide a robust, secure, and developer-friendly architecture for both internal and third-party plugin development.

This comprehensive plan addresses current inconsistencies, implements security best practices, enhances the SDK with common functionality, and creates a standardized development experience that leverages Effect.js patterns while maintaining simplicity for plugin developers. The system will be optimized for Bun runtime while maintaining compatibility with other JavaScript runtimes.

## Types

Enhanced type system with tagged errors, standardized interfaces, and improved schema definitions.

**Tagged Error Types:**
- `PluginNotInitializedError` - When plugin methods are called before initialization
- `TemplateRenderingError` - Template processing failures with context
- `ConfigurationValidationError` - Configuration validation failures with field details
- `NetworkTimeoutError` - Network request timeouts with retry information
- `SecurityViolationError` - Security policy violations (prototype pollution, unsafe templates)
- `ResourceExhaustionError` - Memory/CPU limits exceeded
- `CircuitBreakerOpenError` - Circuit breaker preventing requests

**Enhanced Service Interfaces:**
- `SecurityService` - Deep freezing and prototype pollution validation
- `MetricsService` - Performance monitoring and health checks

## Files

**Plugin Service Enhancements:**
- `packages/pipeline-runner/src/services/plugin.service.ts` - Enhanced executePlugin with metrics, timeouts, retries, circuit breaker
- `packages/pipeline-runner/src/services/security.service.ts` - New security validation service (validate method)
- `packages/pipeline-runner/src/services/metrics.service.ts` - New metrics collection service
- `packages/pipeline-runner/src/services/circuit-breaker.service.ts` - Circuit breaker implementation

**All Plugin Files (9 plugins):**
- Replace console.* with Effect logging
- Standardize error handling with proper retryable flags
- Add proper resource cleanup in shutdown methods

## Functions

Enhanced plugin service functions and minimal SDK utilities.

**Enhanced Plugin Service Functions:**
- `executePlugin<T>(plugin: Plugin, input: T, contextDescription: string, options?: ExecutionOptions): Effect<T>` - Enhanced execution with metrics, timeout, retry, circuit breaker
- `validate<T>(data: T): Effect<T>` - Security validation with deep freezing and prototype pollution check

**ExecutionOptions Interface:**
```typescript
interface ExecutionOptions {
  timeout?: Duration;
  retryPolicy?: Schedule;
  circuitBreakerConfig?: CircuitBreakerConfig;
  enableMetrics?: boolean; // defaults to true
}
```

**Security Utilities (Service Layer):**
- `validate<T>(obj: T): Effect<T>` - Deep freezing + prototype pollution check

## Classes

Simplified approach with enhanced plugin service and minimal SDK utilities.

**Enhanced Plugin Service Interface:**
```typescript
interface EnhancedPluginService extends PluginService {
  readonly initializePlugin: <T extends Plugin>(
    pluginConfig: { pluginId: string; config: unknown },
    contextDescription: string,
  ) => Effect.Effect<T, PluginError>;

  readonly executePlugin: <TInput, TOutput>(
    plugin: Plugin<TInput, TOutput, any>,
    input: TInput,
    contextDescription: string,
    options?: ExecutionOptions
  ) => Effect.Effect<TOutput, PluginError>;

  readonly getPluginMetrics: (pluginId: string) => Effect.Effect<PluginMetrics>;
  readonly getPluginHealth: (pluginId: string) => Effect.Effect<PluginHealth>;
}

interface ExecutionOptions {
  timeout?: Duration;
  retryPolicy?: Schedule;
  circuitBreakerConfig?: CircuitBreakerConfig;
  enableMetrics?: boolean; // defaults to true
}
```

**Security Service (Service Layer):**
```typescript
interface SecurityService {
  readonly validate: <T>(data: T) => Effect.Effect<T>; // Deep freeze + prototype pollution check
}
```

**Metrics Service (Service Layer):**
```typescript
interface MetricsService {
  readonly recordPluginExecution: (pluginId: string, duration: number, success: boolean) => Effect.Effect<void>;
  readonly recordPluginError: (pluginId: string, error: PluginError) => Effect.Effect<void>;
  readonly getPluginMetrics: (pluginId: string) => Effect.Effect<PluginMetrics>;
  readonly getSystemMetrics: () => Effect.Effect<SystemMetrics>;
}
```

**Circuit Breaker Service (Service Layer):**
```typescript
interface CircuitBreakerService {
  readonly executeWithCircuitBreaker: <T>(
    key: string, 
    effect: Effect.Effect<T>, 
    config: CircuitBreakerConfig
  ) => Effect.Effect<T>;
  readonly getCircuitBreakerState: (key: string) => Effect.Effect<CircuitBreakerState>;
}
```


## Dependencies

No new dependencies needed. Focus on improving existing implementation.


## Implementation Order

**Phase 1: Enhanced Plugin Service (Week 1)**
1. Enhance `plugin.service.ts` executePlugin method with:
   - Automatic metrics collection
   - Configurable timeout and retry policies  
   - Circuit breaker integration
   - Deep freezing and prototype pollution validation

2. Implement supporting services:
   - `SecurityService` with validate method
   - `MetricsService` for tracking plugin performance
   - `CircuitBreakerService` for resilience

**Phase 2: Plugin Migration (Week 2-3)**
3. Update all 9 plugins to:
   - Replace console.* with Effect logging
   - Add proper resource cleanup in shutdown methods
   - Ensure proper retryable error flags

**Success Metrics:**
- Zero console.* usage in plugins
- All plugins have proper resource cleanup
- Plugin service handles all infrastructure concerns (metrics, timeouts, retries, security)
- Plugins focus purely on business logic
