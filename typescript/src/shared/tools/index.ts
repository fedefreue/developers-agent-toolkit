import { Tool, ToolContext } from '@/shared/types';

// Documentation tools
import { getDocumentation } from '@/shared/tools/documentation/getDocumentation';
import { getDocumentationSection } from '@/shared/tools/documentation/getDocumentationSection';
import { getDocumentationPage } from '@/shared/tools/documentation/getDocumentationPage';
import { getOAuth10aGuide } from '@/shared/tools/documentation/getOAuth10aGuide';
import { getOpenBankingGuide } from '@/shared/tools/documentation/getOpenBankingGuide';

// Services tools
import { getServicesList } from '@/shared/tools/services/getServicesList';

// Operations tools
import { getApiOperationList } from '@/shared/tools/operations/getApiOperationList';
import { getApiOperationDetails } from '@/shared/tools/operations/getApiOperationDetails';
import { generateApiSampleRequest } from '@/shared/tools/operations/generateApiSampleRequest';

export const tools = (context: ToolContext): Tool[] => [
  // Services
  getServicesList(context),

  // Documentation
  getDocumentation(context),
  getDocumentationSection(context),
  getDocumentationPage(context),
  getOAuth10aGuide(context),
  getOpenBankingGuide(context),

  // API Operations
  getApiOperationList(context),
  getApiOperationDetails(context),
  generateApiSampleRequest(context),
];
