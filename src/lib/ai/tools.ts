import { z } from 'zod';
import { tool } from 'ai';

export const editFileTool = tool({
  description: 'Edit a file by replacing specific text content',
  inputSchema: z.object({
    filePath: z.string().describe('The path of the file to edit'),
    oldText: z.string().describe('The exact text to find and replace'),
    newText: z.string().describe('The new text to replace with'),
  }),
  execute: async ({ filePath, oldText, newText }) => {
    return { filePath, oldText, newText, applied: false };
  },
});

export const readFileTool = tool({
  description: 'Read the contents of a file',
  inputSchema: z.object({
    filePath: z.string().describe('The path of the file to read'),
  }),
  execute: async ({ filePath }) => {
    return { filePath, content: '' };
  },
});

export const aiTools = {
  editFile: editFileTool,
  readFile: readFileTool,
};
