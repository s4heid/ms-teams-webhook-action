/**
 * Mock for @actions/http-client
 * Used in tests to simulate HTTP requests without actual network calls.
 */

export interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export interface MockHttpClient {
  post: jest.Mock
  get: jest.Mock

  // Track calls for assertions
  calls: Array<{
    method: string
    url: string
    body?: string
    headers?: Record<string, string>
  }>

  // Configure responses
  setResponse: (response: MockResponse) => void
  setResponseForUrl: (url: string, response: MockResponse) => void
  setErrorForUrl: (url: string, error: Error) => void

  // Reset all mocks
  reset: () => void
}

export function createMockHttpClient(): MockHttpClient {
  const calls: MockHttpClient['calls'] = []
  let defaultResponse: MockResponse = {
    statusCode: 200,
    headers: {},
    body: '{}',
  }
  const responsesByUrl = new Map<string, MockResponse>()
  const errorsByUrl = new Map<string, Error>()

  const createMockHttpResponse = (response: MockResponse) => ({
    message: {
      statusCode: response.statusCode,
      headers: response.headers,
    },
    readBody: jest.fn().mockResolvedValue(response.body),
  })

  const mock: MockHttpClient = {
    calls,

    post: jest.fn(
      async (
        url: string,
        body: string,
        headers?: Record<string, string>
      ) => {
        calls.push({ method: 'POST', url, body, headers })

        if (errorsByUrl.has(url)) {
          throw errorsByUrl.get(url)
        }

        const response = responsesByUrl.get(url) ?? defaultResponse
        return createMockHttpResponse(response)
      }
    ),

    get: jest.fn(async (url: string, headers?: Record<string, string>) => {
      calls.push({ method: 'GET', url, headers })

      if (errorsByUrl.has(url)) {
        throw errorsByUrl.get(url)
      }

      const response = responsesByUrl.get(url) ?? defaultResponse
      return createMockHttpResponse(response)
    }),

    setResponse: (response: MockResponse) => {
      defaultResponse = response
    },

    setResponseForUrl: (url: string, response: MockResponse) => {
      responsesByUrl.set(url, response)
    },

    setErrorForUrl: (url: string, error: Error) => {
      errorsByUrl.set(url, error)
    },

    reset: () => {
      calls.length = 0
      defaultResponse = {
        statusCode: 200,
        headers: {},
        body: '{}',
      }
      responsesByUrl.clear()
      errorsByUrl.clear()
      mock.post.mockClear()
      mock.get.mockClear()
    },
  }

  return mock
}
