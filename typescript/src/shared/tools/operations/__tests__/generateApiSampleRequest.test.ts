import { execute } from '@/shared/tools/operations/generateApiSampleRequest';
import api from '@/shared/api';

// Mock the API module so we can control the operation details returned to the
// tool. This allows the test to run entirely offline.
jest.mock<typeof api>('@/shared/api');

// Cast the mocked module for easier access to the spy functions.
const mockApi = api as jest.Mocked<typeof api>;

describe('generateApiSampleRequest.execute', () => {
  beforeEach(() => {
    // Reset mocks before each test to avoid cross-test interference.
    jest.clearAllMocks();
  });

  it('should generate a populated curl snippet', async () => {
    // The mocked API returns an operation that includes path, query, header
    // parameters and a JSON request body. Each field intentionally lacks an
    // explicit example so the tool must synthesise values.
    mockApi.getApiOperationDetails.mockResolvedValue(
      JSON.stringify({
        servers: [{ url: 'https://api.example.com' }],
        path: '/payments/{paymentId}',
        parameters: [
          { name: 'paymentId', in: 'path', schema: { type: 'string' } },
          { name: 'verbose', in: 'query', schema: { type: 'boolean' } },
          { name: 'X-Auth', in: 'header', schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { amount: { type: 'number' } },
              },
            },
          },
        },
      })
    );

    // Execute the tool and ensure it calls the API with the expected
    // parameters and produces a snippet containing the derived example values.
    const snippet = await execute(
      { apiSpecificationPath: '/spec.yaml' },
      { method: 'POST', path: '/payments/{paymentId}' }
    );

    expect(mockApi.getApiOperationDetails).toHaveBeenCalledWith(
      '/spec.yaml',
      'POST',
      '/payments/{paymentId}'
    );
    expect(snippet).toContain(
      "curl -X POST 'https://api.example.com/payments/string?verbose=true'"
    );
    expect(snippet).toContain("-H 'X-Auth: string'");
    expect(snippet).toContain('"amount":0');
  });
});
