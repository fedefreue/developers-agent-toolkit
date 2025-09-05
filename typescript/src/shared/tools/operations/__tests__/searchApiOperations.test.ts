import {
  execute,
  getParameters,
} from '@/shared/tools/operations/searchApiOperations';
import api from '@/shared/api';

// Mock the API module so tests can control the responses from
// getApiOperations without performing network requests.
jest.mock<typeof api>('@/shared/api');

const mockApi = api as jest.Mocked<typeof api>;

describe('execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter operations based on query', async () => {
    // Sample operations returned by the mocked API.
    const operations = [
      {
        summary: 'Get payment',
        description: 'Retrieve payment',
        tags: ['Payments'],
      },
      {
        summary: 'List accounts',
        description: 'Retrieve accounts',
        tags: ['Accounts', 'Finance'],
      },
    ];
    mockApi.getApiOperations.mockResolvedValue(JSON.stringify({ operations }));

    // Execute the tool with a search query that matches the first operation.
    const result = await execute(
      {},
      { apiSpecificationPath: '/spec.yaml', query: 'payment' }
    );

    expect(mockApi.getApiOperations).toHaveBeenCalledWith('/spec.yaml');
    // Only the operation matching the query should be returned.
    expect(JSON.parse(result)).toEqual([operations[0]]);
  });

  it('should filter operations based on query and tag with context path', async () => {
    // Same operations as above but the search also filters by tag.
    const operations = [
      {
        summary: 'Get payment',
        description: 'Retrieve payment',
        tags: ['Payments'],
      },
      {
        summary: 'List accounts',
        description: 'Retrieve accounts',
        tags: ['Accounts', 'Finance'],
      },
    ];
    mockApi.getApiOperations.mockResolvedValue(JSON.stringify({ operations }));

    // The context already supplies the spec path, so only query and tag are
    // passed in.
    const result = await execute(
      { apiSpecificationPath: '/context.yaml' },
      { query: 'account', tag: 'Finance' }
    );

    expect(mockApi.getApiOperations).toHaveBeenCalledWith('/context.yaml');
    // The second operation matches both the query and the tag.
    expect(JSON.parse(result)).toEqual([operations[1]]);
  });
});

describe('getParameters', () => {
  it('should return the correct parameters if no context', () => {
    // When no spec path is provided in the context the schema should include
    // apiSpecificationPath in addition to query and tag.
    const parameters = getParameters({});

    const fields = Object.keys(parameters.shape);
    expect(fields).toEqual(['apiSpecificationPath', 'query', 'tag']);
    expect(fields.length).toBe(3);
  });

  it('should return the correct parameters if apiSpecificationPath is specified in context', () => {
    // With an existing spec path in the context only query and tag are needed.
    const parameters = getParameters({
      apiSpecificationPath: '/test/path.yaml',
    });

    const fields = Object.keys(parameters.shape);
    expect(fields).toEqual(['query', 'tag']);
    expect(fields.length).toBe(2);
  });
});
