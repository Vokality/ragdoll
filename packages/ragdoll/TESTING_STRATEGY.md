# Testing Strategy for Ragdoll

## Current Testability Challenges

1. **Hard-coded dependencies**: Controllers create their own dependencies in constructors
2. **No interfaces**: Difficult to create mocks/test doubles
3. **Time dependencies**: `Date.now()`, `setInterval`, `requestAnimationFrame` make tests non-deterministic
4. **Side effects**: Direct DOM manipulation, global state
5. **Tight coupling**: Some controllers are tightly coupled to concrete implementations

## Proposed Improvements

### 1. Dependency Injection

**Problem**: Controllers create their own dependencies

```typescript
// Current - not testable
constructor() {
  this.skeleton = new RagdollSkeleton();
  this.geometry = new RagdollGeometry();
}
```

**Solution**: Inject dependencies

```typescript
// Better - testable
constructor(
  skeleton?: RagdollSkeleton,
  geometry?: RagdollGeometry
) {
  this.skeleton = skeleton ?? new RagdollSkeleton();
  this.geometry = geometry ?? new RagdollGeometry();
}
```

### 2. Interface-Based Design

**Problem**: No interfaces for mocking

**Solution**: Define interfaces for major components

```typescript
export interface ICharacterController {
  setMood(mood: FacialMood, duration?: number): void;
  triggerAction(action: FacialAction, duration?: number): void;
  update(deltaTime: number): void;
  getState(): CharacterState;
}

export interface IActionController {
  triggerAction(action: FacialAction, duration?: number): void;
  clearAction(): void;
  update(deltaTime: number): void;
  getActiveAction(): FacialAction | null;
}
```

### 3. Time Abstraction

**Problem**: Hard to test time-dependent behavior

**Solution**: Create a `Clock` interface

```typescript
export interface IClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(callback: () => void, ms: number): number;
  clearInterval(id: number): void;
}

// Real implementation
export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
  setTimeout(callback: () => void, ms: number) {
    return setTimeout(callback, ms);
  }
  // ...
}

// Test implementation
export class MockClock implements IClock {
  private currentTime = 0;

  now(): number {
    return this.currentTime;
  }
  advance(ms: number): void {
    this.currentTime += ms;
  }
  // ...
}
```

### 4. Factory Pattern for Controllers

**Solution**: Use factories for controller creation

```typescript
export class ControllerFactory {
  createCharacterController(options?: {
    themeId?: string;
    skeleton?: RagdollSkeleton;
    geometry?: RagdollGeometry;
    stateManager?: StateManager;
    eventBus?: EventBus;
    clock?: IClock;
  }): CharacterController {
    return new CharacterController(options);
  }
}
```

### 5. Test Utilities

Create helper utilities for testing:

```typescript
// Test doubles
export class MockStateManager implements IStateManager { ... }
export class SpyEventBus extends EventBus { ... }
export class FakeActionController implements IActionController { ... }

// Builders
export class CharacterStateBuilder {
  private state: CharacterState = getDefaultState();

  withMood(mood: FacialMood) {
    this.state.mood = mood;
    return this;
  }

  build(): CharacterState {
    return { ...this.state };
  }
}

// Assertions
export function expectStateEquals(actual: CharacterState, expected: CharacterState) { ... }
```

## Testing Layers

### Unit Tests

- Test individual controllers in isolation
- Use mocks for dependencies
- Fast, deterministic

### Integration Tests

- Test controller interactions
- Use real StateManager and EventBus
- Test state synchronization

### Component Tests

- Test React components with mocked controllers
- Use React Testing Library

### E2E Tests (optional)

- Test full system with Playwright/Cypress

## Example Tests

### Unit Test - ActionController

```typescript
describe("ActionController", () => {
  it("should trigger shake action", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);

    expect(controller.getActiveAction()).toBe("shake");
  });

  it("should complete shake after duration", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);
    controller.update(0.7); // Exceed duration

    expect(controller.getActiveAction()).toBeNull();
  });
});
```

### Integration Test - State Synchronization

```typescript
describe("State Synchronization", () => {
  it("should emit events when state changes", () => {
    const eventBus = new EventBus();
    const stateManager = new StateManager(getDefaultState(), eventBus);
    const events: StateEvent[] = [];

    eventBus.subscribe((event) => events.push(event));

    stateManager.setMood("smile", "neutral");

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "moodChanged",
      mood: "smile",
      previousMood: "neutral",
    });
  });
});
```

### Plugin Test

```typescript
describe("PomodoroPlugin", () => {
  it("should initialize with controller", () => {
    const mockController = createMockCharacterController();
    const plugin = new PomodoroPlugin();

    plugin.initialize(mockController);

    expect(plugin.getPomodoroController()).toBeDefined();
  });

  it("should cleanup on destroy", () => {
    const mockController = createMockCharacterController();
    const plugin = new PomodoroPlugin();
    plugin.initialize(mockController);

    const pomodoro = plugin.getPomodoroController()!;
    pomodoro.start(30, 5);

    plugin.destroy();

    expect(pomodoro.getState().state).toBe("idle");
  });
});
```

## Implementation Priority

1. **High Priority** (enables all other tests):
   - Add dependency injection to CharacterController
   - Create Clock abstraction for PomodoroController
   - Add interfaces for major controllers

2. **Medium Priority** (improves test quality):
   - Create test utilities and builders
   - Add factory pattern
   - Extract pure functions

3. **Low Priority** (nice to have):
   - Integration test suite
   - Component test examples
   - E2E test examples

## Benefits

- ✅ Fast, deterministic tests
- ✅ Easy to mock dependencies
- ✅ Can test edge cases (time boundaries, state transitions)
- ✅ Better refactoring confidence
- ✅ Documentation through tests
- ✅ Easier debugging
