import { z } from 'zod';
import { tool } from 'ai';

export const editFileTool = tool({
  description:
    'Edit text in the user\'s current document by finding and replacing a specific passage. ' +
    'ALWAYS use this tool when the user asks you to edit, modify, rewrite, fix, improve, shorten, expand, translate, or change any text in their document. ' +
    'The oldText must be an EXACT substring from the document content provided in the system context. ' +
    'The newText is your replacement. The user will see a diff and can accept or reject.',
  inputSchema: z.object({
    oldText: z.string().describe('The exact text to find in the document (must match verbatim)'),
    newText: z.string().describe('The replacement text'),
  }),
  execute: async ({ oldText, newText }) => {
    // The client renders a diff with Accept/Reject buttons.
    // Return success so the model knows the edit was proposed.
    return { success: true, message: 'Edit diff shown to the user for review. They can accept, modify, or reject it.' };
  },
});

export const aiTools = {
  editFile: editFileTool,
};
