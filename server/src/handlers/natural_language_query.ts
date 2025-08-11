import { db } from '../db';
import { repositoriesTable, codeFilesTable, codeFunctionsTable, codeIssuesTable } from '../db/schema';
import { type NaturalLanguageQueryInput, type AiAnalysisResponse } from '../schema';
import { eq, and, ilike, or } from 'drizzle-orm';

export async function naturalLanguageQuery(input: NaturalLanguageQueryInput): Promise<AiAnalysisResponse> {
  try {
    // Verify repository exists
    const repository = await db.select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.id, input.repository_id))
      .limit(1)
      .execute();

    if (repository.length === 0) {
      throw new Error(`Repository not found with id: ${input.repository_id}`);
    }

    // Extract keywords from the question for searching
    const keywords = extractKeywords(input.question);
    
    // Search for relevant files based on question keywords
    const baseCondition = eq(codeFilesTable.repository_id, input.repository_id);
    let relevantFiles;

    // If context files are specified, prioritize those
    if (input.context_files && input.context_files.length > 0) {
      const contextConditions = input.context_files.map(file => 
        ilike(codeFilesTable.path, `%${file}%`)
      );
      relevantFiles = await db.select()
        .from(codeFilesTable)
        .where(and(
          baseCondition,
          or(...contextConditions)
        ))
        .limit(10)
        .execute();
    } else if (keywords.length > 0) {
      // Search in file paths, content, and AI summaries - use OR to be more inclusive
      const searchConditions = keywords.flatMap(keyword => [
        ilike(codeFilesTable.path, `%${keyword}%`),
        ilike(codeFilesTable.content, `%${keyword}%`),
        ilike(codeFilesTable.ai_summary, `%${keyword}%`)
      ]);
      
      relevantFiles = await db.select()
        .from(codeFilesTable)
        .where(and(
          baseCondition,
          or(...searchConditions)
        ))
        .limit(10)
        .execute();
    } else {
      relevantFiles = await db.select()
        .from(codeFilesTable)
        .where(baseCondition)
        .limit(10)
        .execute();
    }

    // Get functions from relevant files
    let keyFunctions: string[] = [];
    if (relevantFiles.length > 0) {
      const fileIds = relevantFiles.map(f => f.id);
      
      // Get all functions from relevant files first
      const allFunctions = await db.select()
        .from(codeFunctionsTable)
        .where(or(...fileIds.map(id => eq(codeFunctionsTable.file_id, id))))
        .limit(10)
        .execute();

      // If we have keywords, try to prioritize functions that match them
      if (keywords.length > 0) {
        const matchingFunctions = allFunctions.filter(func => 
          keywords.some(keyword => 
            func.name.toLowerCase().includes(keyword) ||
            func.signature.toLowerCase().includes(keyword) ||
            (func.ai_explanation && func.ai_explanation.toLowerCase().includes(keyword))
          )
        );

        // Use matching functions first, then fill with others
        const nonMatchingFunctions = allFunctions.filter(func => !matchingFunctions.includes(func));
        const prioritizedFunctions = [...matchingFunctions, ...nonMatchingFunctions].slice(0, 5);
        keyFunctions = prioritizedFunctions.map(f => f.name);
      } else {
        keyFunctions = allFunctions.slice(0, 5).map(f => f.name);
      }
    }

    // Get potential issues from relevant files
    let potentialIssues: string[] = [];
    if (relevantFiles.length > 0) {
      const fileIds = relevantFiles.map(f => f.id);
      const issues = await db.select()
        .from(codeIssuesTable)
        .where(or(...fileIds.map(id => eq(codeIssuesTable.file_id, id))))
        .limit(5)
        .execute();

      potentialIssues = issues.map(issue => 
        `${issue.issue_type}: ${issue.description}`
      );
    }

    // Generate summary based on analysis
    const summary = generateSummary(input.question, relevantFiles, keyFunctions, potentialIssues);

    // Generate suggestions based on the question and findings
    const suggestions = generateSuggestions(input.question, relevantFiles, potentialIssues);

    // Get related file paths
    const relatedFiles = relevantFiles.slice(0, 5).map(f => f.path);

    return {
      summary,
      key_functions: keyFunctions,
      potential_issues: potentialIssues,
      suggestions,
      related_files: relatedFiles
    };
  } catch (error) {
    console.error('Natural language query failed:', error);
    throw error;
  }
}

function extractKeywords(question: string): string[] {
  // Remove common stop words and extract meaningful keywords
  const stopWords = new Set([
    'what', 'where', 'when', 'why', 'how', 'who', 'which', 'can', 'could', 
    'should', 'would', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that',
    'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  const baseKeywords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Add related terms for common concepts
  const expandedKeywords = [...baseKeywords];
  
  if (baseKeywords.includes('authentication') || baseKeywords.includes('authenticate')) {
    expandedKeywords.push('auth', 'login', 'user', 'validate', 'credential');
  }
  
  if (baseKeywords.includes('security') || baseKeywords.includes('secure')) {
    expandedKeywords.push('vulnerability', 'validation', 'sanitize', 'xss', 'injection');
  }
  
  if (baseKeywords.includes('performance') || baseKeywords.includes('optimize')) {
    expandedKeywords.push('slow', 'speed', 'efficiency', 'complexity');
  }

  return [...new Set(expandedKeywords)].slice(0, 15); // Remove duplicates and limit
}

function generateSummary(
  question: string, 
  files: any[], 
  functions: string[], 
  issues: string[]
): string {
  if (files.length === 0) {
    return `No relevant code files found for the question: "${question}". The repository may not contain code related to your query.`;
  }

  let summary = `Analysis for question: "${question}". `;
  summary += `Found ${files.length} relevant code file(s) `;
  
  if (functions.length > 0) {
    summary += `with ${functions.length} key function(s) `;
  }
  
  if (issues.length > 0) {
    summary += `and ${issues.length} identified issue(s) `;
  }
  
  summary += 'that may be related to your query.';

  // Add file type analysis
  const languages = new Set(files.map(f => f.language).filter(Boolean));
  if (languages.size > 0) {
    summary += ` The code is primarily written in: ${Array.from(languages).join(', ')}.`;
  }

  return summary;
}

function generateSuggestions(
  question: string, 
  files: any[], 
  issues: string[]
): string[] {
  const suggestions: string[] = [];

  if (files.length === 0) {
    suggestions.push('Consider adding more detailed file paths or context to your query');
    suggestions.push('Try using specific function names or file names in your question');
    return suggestions;
  }

  // Generic suggestions based on question keywords
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('performance') || lowerQuestion.includes('slow') || lowerQuestion.includes('optimize')) {
    suggestions.push('Review code complexity scores and consider optimization opportunities');
    suggestions.push('Look for inefficient algorithms or database queries');
  }
  
  if (lowerQuestion.includes('error') || lowerQuestion.includes('bug') || lowerQuestion.includes('issue')) {
    suggestions.push('Check error handling patterns in the identified files');
    suggestions.push('Add comprehensive unit tests for critical functions');
  }
  
  if (lowerQuestion.includes('security') || lowerQuestion.includes('secure') || lowerQuestion.includes('vulnerability')) {
    suggestions.push('Conduct a security audit of input validation and authentication');
    suggestions.push('Review data sanitization practices');
  }

  // Suggestions based on found issues
  if (issues.length > 0) {
    suggestions.push('Address the identified code issues for better code quality');
    suggestions.push('Prioritize high and critical severity issues first');
  }

  // General suggestions
  if (files.some(f => !f.ai_summary)) {
    suggestions.push('Generate AI summaries for files to improve future query accuracy');
  }

  // Ensure we always have at least one suggestion
  if (suggestions.length === 0) {
    suggestions.push('Review the identified files for potential improvements');
    suggestions.push('Consider adding more detailed documentation to the codebase');
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}