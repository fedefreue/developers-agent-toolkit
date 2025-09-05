import { z } from 'zod';
import { Tool, ToolContext } from '@/shared/types';
import api from '@/shared/api';

// Minimal shape describing an API operation. Only the fields that are
// relevant for searching are modeled here.
type ApiOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  [key: string]: any;
};

// Build the description shown to tool consumers. The description differs
// depending on whether the specification path is supplied in the context or
// must be provided by the caller.
const getDescription = (context: ToolContext): string => {
  const baseDescription = `Searches API operations within a specification by keyword and optional tag, filtering by matches in summary, description, or tags.`;

  if (context.apiSpecificationPath) {
    // When the path is predefined in the context we only expose query and tag
    // parameters to the user.
    return `${baseDescription}\n\nUses the configured API specification: ${context.apiSpecificationPath}\n\nIt takes two arguments:\n- query (str): The search query to match against operation summary, description, or tags\n- tag (str, optional): A tag name to filter operations`;
  }

  // Otherwise the caller must provide the specification path in addition to
  // the search criteria.
  return `${baseDescription}\n\nIt takes three arguments:\n- apiSpecificationPath (str): The path to the API specification file (e.g., /open-banking-us/swagger/openbanking-us.yaml)\n- query (str): The search query to match against operation summary, description, or tags\n- tag (str, optional): A tag name to filter operations`;
};

// Construct a Zod schema describing the tool parameters. If the
// specification path is already supplied in the context we omit it from the
// required parameters.
export const getParameters = (context: ToolContext): z.ZodObject<any> => {
  const baseParams = {
    // Free text to match against summary, description or tags.
    query: z
      .string()
      .describe(
        'The search query to match against operation summary, description, or tags'
      ),
    // Optional tag to further narrow down the results.
    tag: z.string().optional().describe('A tag name to filter operations'),
  };

  if (context.apiSpecificationPath) {
    // No need to request the spec path again if it is already configured.
    return z.object(baseParams);
  }

  // Otherwise include the spec path parameter so the tool knows which spec to
  // read.
  return z.object({
    apiSpecificationPath: z
      .string()
      .describe(
        'The path to the API specification file (e.g., /open-banking-us/swagger/openbanking-us.yaml)'
      ),
    ...baseParams,
  });
};

// Execute the search. Operations are fetched from the API and then filtered
// locally based on the provided search query and optional tag.
export const execute = async (
  context: ToolContext,
  params: z.infer<ReturnType<typeof getParameters>>
): Promise<string> => {
  // Determine the path to the specification from the context or parameters.
  const apiSpecificationPath =
    context.apiSpecificationPath ?? params.apiSpecificationPath;

  // Retrieve the list of operations from the API service.
  const response = await api.getApiOperations(apiSpecificationPath);
  let parsed: any;
  try {
    // The API returns JSON by convention. If parsing fails, forward the raw
    // response so callers can inspect the error.
    parsed = JSON.parse(response);
  } catch {
    return response;
  }

  // Normalize the operations into an array regardless of whether the payload
  // is wrapped in an { operations } object or is already an array.
  const operations: ApiOperation[] = Array.isArray(parsed.operations)
    ? parsed.operations
    : Array.isArray(parsed)
      ? parsed
      : [];

  // Prepare the search criteria in lowercase for case-insensitive matching.
  const query = params.query.toLowerCase();
  const tag = params.tag?.toLowerCase();

  const filtered = operations.filter((op) => {
    // Coerce values to strings and lowercase to simplify searching.
    const summary = (op.summary ?? '').toLowerCase();
    const description = (op.description ?? '').toLowerCase();
    const tags = Array.isArray(op.tags)
      ? op.tags.map((t) => t.toLowerCase())
      : [];

    // A match occurs if the query is found in any of the searchable fields.
    const matchesQuery =
      summary.includes(query) ||
      description.includes(query) ||
      tags.some((t) => t.includes(query));

    // If a tag was specified, ensure the operation contains it.
    const matchesTag = tag ? tags.includes(tag) : true;

    return matchesQuery && matchesTag;
  });

  // Return the matching operations as pretty-printed JSON so the caller can
  // inspect them directly.
  return JSON.stringify(filtered, null, 2);
};

// Factory that exposes the tool in a format understood by the runtime.
export const searchApiOperations = (context: ToolContext): Tool => ({
  method: 'search-api-operations',
  name: 'Search API Operations',
  description: getDescription(context),
  parameters: getParameters(context),
  execute: (params) => execute(context, params),
});
