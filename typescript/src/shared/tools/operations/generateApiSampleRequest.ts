import { z } from 'zod';
import { Tool, ToolContext } from '@/shared/types';
import api from '@/shared/api';

/**
 * Builds the description for the tool. When an API specification path is
 * already provided in the surrounding context, we omit it from the argument
 * list and explain that the tool will use the preconfigured specification.
 */
const getDescription = (context: ToolContext): string => {
  const baseDescription = `Generates a sample API request snippet (cURL) for a specific API operation
using example values for parameters and request body derived from the API specification.`;

  if (context.apiSpecificationPath) {
    return `${baseDescription}\n\nUses the configured API specification: ${context.apiSpecificationPath}\n\nIt takes two arguments:\n- method (str): The HTTP method of the operation (e.g., GET, POST, PUT, DELETE)\n- path (str): The API endpoint path from the specification (e.g., /payments, /accounts/{id})`;
  }

  return `${baseDescription}\n\nIt takes three arguments:\n- apiSpecificationPath (str): The path to the API specification file (e.g., /open-banking-us/swagger/openbanking-us.yaml)\n- method (str): The HTTP method of the operation (e.g., GET, POST, PUT, DELETE)\n- path (str): The API endpoint path from the specification (e.g., /payments, /accounts/{id})`;
};

/**
 * Parameter schema for the tool. If the caller has already configured an
 * API specification path on the context we only require `method` and `path`;
 * otherwise `apiSpecificationPath` is also mandatory.
 */
export const getParameters = (context: ToolContext): z.ZodObject<any> => {
  const baseParams = {
    method: z
      .string()
      .describe(
        'The HTTP method of the operation (e.g., GET, POST, PUT, DELETE)'
      ),
    path: z
      .string()
      .describe(
        'The API endpoint path from the specification (e.g., /payments, /accounts/{id})'
      ),
  };

  if (context.apiSpecificationPath) {
    return z.object(baseParams);
  }

  return z.object({
    apiSpecificationPath: z
      .string()
      .describe(
        'The path to the API specification (e.g., /open-banking-us/swagger/openbanking-us.yaml)'
      ),
    ...baseParams,
  });
};

/**
 * Produces a best-effort example value for a given OpenAPI schema node. The
 * function prefers explicit example, default or enum values and otherwise
 * generates primitive placeholders to keep the snippet realistic.
 */
const generateExample = (schema: any): any => {
  if (!schema) return 'example';
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0)
    return schema.enum[0];

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      return [generateExample(schema.items)];
    case 'object': {
      const obj: Record<string, any> = {};
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          obj[key] = generateExample(value);
        }
      }
      return obj;
    }
    default:
      return 'example';
  }
};

/**
 * Core implementation of the tool. It retrieves the operation definition from
 * the API specification and assembles a cURL command that includes example
 * values for all parameters and, when present, the request body.
 */
export const execute = async (
  context: ToolContext,
  params: z.infer<ReturnType<typeof getParameters>>
): Promise<string> => {
  const specPath = context.apiSpecificationPath ?? params.apiSpecificationPath;
  const method = params.method.toUpperCase();
  const path = params.path;

  // Fetch the OpenAPI operation details from the server and parse them.
  const detailsText = await api.getApiOperationDetails(specPath!, method, path);

  let details: any;
  try {
    details = JSON.parse(detailsText);
  } catch {
    throw new Error('Invalid operation details returned by API');
  }

  const serverUrl = details.servers?.[0]?.url ?? 'https://api.mastercard.com';

  // Build URL, query string and headers using the operation's parameters.
  let urlPath: string = details.path || path;
  const queryParams: string[] = [];
  const headers: string[] = [];

  if (Array.isArray(details.parameters)) {
    for (const param of details.parameters) {
      const value = param.example ?? generateExample(param.schema);
      if (param.in === 'path') {
        // Replace path placeholders like `/payments/{id}` with example values.
        urlPath = urlPath.replace(
          `{${param.name}}`,
          encodeURIComponent(String(value))
        );
      } else if (param.in === 'query') {
        queryParams.push(
          `${encodeURIComponent(param.name)}=${encodeURIComponent(String(value))}`
        );
      } else if (param.in === 'header') {
        headers.push(`${param.name}: ${value}`);
      }
    }
  }

  // Include a JSON body when the operation declares one.
  let body: any = undefined;
  const jsonContent = details.requestBody?.content?.['application/json'];
  if (jsonContent) {
    body = jsonContent.example ?? generateExample(jsonContent.schema);
    headers.push('Content-Type: application/json');
  }

  let url = `${serverUrl}${urlPath}`;
  if (queryParams.length > 0) {
    url += `?${queryParams.join('&')}`;
  }

  // Assemble the final cURL command with headers and optional data payload.
  let command = `curl -X ${method} '${url}'`;
  for (const header of headers) {
    command += ` -H '${header}'`;
  }
  if (body !== undefined) {
    command += ` -d '${JSON.stringify(body)}'`;
  }

  return command;
};

export const generateApiSampleRequest = (context: ToolContext): Tool => ({
  method: 'generate-api-sample-request',
  name: 'Generate API Sample Request',
  description: getDescription(context),
  parameters: getParameters(context),
  execute: (params) => execute(context, params),
});
