import { db } from '../db';
import { codeIssuesTable, codeFilesTable } from '../db/schema';
import { type CodeIssue } from '../schema';
import { eq, and, inArray, type SQL } from 'drizzle-orm';

export interface GetCodeIssuesFilters {
  severity?: ('low' | 'medium' | 'high' | 'critical')[];
  issue_type?: ('bug' | 'performance' | 'security' | 'style' | 'maintainability')[];
  file_path?: string;
}

export const getCodeIssues = async (
  repositoryId: number,
  filters?: GetCodeIssuesFilters
): Promise<CodeIssue[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [
      eq(codeFilesTable.repository_id, repositoryId)
    ];

    // Apply filters if provided
    if (filters) {
      if (filters.severity && filters.severity.length > 0) {
        conditions.push(inArray(codeIssuesTable.severity, filters.severity));
      }

      if (filters.issue_type && filters.issue_type.length > 0) {
        conditions.push(inArray(codeIssuesTable.issue_type, filters.issue_type));
      }

      if (filters.file_path) {
        conditions.push(eq(codeFilesTable.path, filters.file_path));
      }
    }

    // Build query with all conditions applied at once
    const results = await db.select({
      id: codeIssuesTable.id,
      file_id: codeIssuesTable.file_id,
      issue_type: codeIssuesTable.issue_type,
      severity: codeIssuesTable.severity,
      description: codeIssuesTable.description,
      line_number: codeIssuesTable.line_number,
      suggestion: codeIssuesTable.suggestion,
      created_at: codeIssuesTable.created_at
    })
    .from(codeIssuesTable)
    .innerJoin(codeFilesTable, eq(codeIssuesTable.file_id, codeFilesTable.id))
    .where(and(...conditions))
    .execute();

    // Convert result to match CodeIssue schema
    return results.map(result => ({
      id: result.id,
      file_id: result.file_id,
      issue_type: result.issue_type,
      severity: result.severity,
      description: result.description,
      line_number: result.line_number,
      suggestion: result.suggestion,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Failed to get code issues:', error);
    throw error;
  }
};