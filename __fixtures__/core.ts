/**
 * Mock for @actions/core
 * Used in tests to verify core functionality without actual GitHub Actions context.
 */

export interface MockCore {
  getInput: jest.Mock
  getBooleanInput: jest.Mock
  setOutput: jest.Mock
  setFailed: jest.Mock
  info: jest.Mock
  warning: jest.Mock
  error: jest.Mock
  debug: jest.Mock
  setSecret: jest.Mock
  isDebug: jest.Mock

  // Track calls for assertions
  inputs: Map<string, string>
  outputs: Map<string, string>
  secrets: Set<string>

  // Helper to set inputs
  setInputs: (inputs: Record<string, string>) => void

  // Reset all mocks
  reset: () => void
}

export function createMockCore(): MockCore {
  const inputs = new Map<string, string>()
  const outputs = new Map<string, string>()
  const secrets = new Set<string>()

  const mock: MockCore = {
    inputs,
    outputs,
    secrets,

    getInput: jest.fn((name: string, options?: { required?: boolean }) => {
      const value = inputs.get(name) ?? ''
      if (options?.required && !value) {
        throw new Error(`Input required and not supplied: ${name}`)
      }
      return value
    }),

    getBooleanInput: jest.fn((name: string) => {
      const value = inputs.get(name)?.toLowerCase()
      if (value === 'true') return true
      if (value === 'false') return false
      throw new Error(`Input "${name}" must be a boolean: ${value}`)
    }),

    setOutput: jest.fn((name: string, value: string) => {
      outputs.set(name, value)
    }),

    setFailed: jest.fn((message: string | Error) => {
      const msg = message instanceof Error ? message.message : message
      console.error(`[FAILED] ${msg}`)
    }),

    info: jest.fn((message: string) => {
      console.log(`[INFO] ${message}`)
    }),

    warning: jest.fn((message: string) => {
      console.warn(`[WARNING] ${message}`)
    }),

    error: jest.fn((message: string | Error) => {
      const msg = message instanceof Error ? message.message : message
      console.error(`[ERROR] ${msg}`)
    }),

    debug: jest.fn((message: string) => {
      console.log(`[DEBUG] ${message}`)
    }),

    setSecret: jest.fn((secret: string) => {
      secrets.add(secret)
    }),

    isDebug: jest.fn(() => false),

    setInputs: (newInputs: Record<string, string>) => {
      inputs.clear()
      for (const [key, value] of Object.entries(newInputs)) {
        inputs.set(key, value)
      }
    },

    reset: () => {
      inputs.clear()
      outputs.clear()
      secrets.clear()
      mock.getInput.mockClear()
      mock.getBooleanInput.mockClear()
      mock.setOutput.mockClear()
      mock.setFailed.mockClear()
      mock.info.mockClear()
      mock.warning.mockClear()
      mock.error.mockClear()
      mock.debug.mockClear()
      mock.setSecret.mockClear()
      mock.isDebug.mockClear()
    },
  }

  return mock
}
