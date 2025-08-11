import { db } from '../db';
import { codeFilesTable } from '../db/schema';
import { type CreateCodeFileInput, type CodeFile } from '../schema';

export const createCodeFile = async (input: CreateCodeFileInput): Promise<CodeFile> => {
  try {
    // Insert code file record
    const result = await db.insert(codeFilesTable)
      .values({
        repository_id: input.repository_id,
        path: input.path,
        content: input.content,
        language: input.language || null,
        size: input.size
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const codeFile = result[0];
    return {
      ...codeFile,
      complexity_score: codeFile.complexity_score ? parseFloat(codeFile.complexity_score) : null
    };
  } catch (error) {
    console.error('Code file creation failed:', error);
    throw error;
  }
};