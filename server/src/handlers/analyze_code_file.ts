import { db } from '../db';
import { codeFilesTable, codeFunctionsTable } from '../db/schema';
import { type CodeFile, type CreateCodeFunctionInput } from '../schema';
import { eq } from 'drizzle-orm';

export const analyzeCodeFile = async (fileId: number): Promise<CodeFile> => {
  try {
    // First, verify the file exists
    const existingFiles = await db.select()
      .from(codeFilesTable)
      .where(eq(codeFilesTable.id, fileId))
      .execute();

    if (existingFiles.length === 0) {
      throw new Error(`Code file with ID ${fileId} not found`);
    }

    const existingFile = existingFiles[0];

    // Simple AI analysis simulation based on content
    const aiSummary = generateAISummary(existingFile.content, existingFile.language);
    const complexityScore = calculateComplexityScore(existingFile.content);

    // Update the file with AI analysis results
    const updatedFiles = await db.update(codeFilesTable)
      .set({
        ai_summary: aiSummary,
        complexity_score: complexityScore.toString(), // Convert to string for numeric column
        last_updated: new Date()
      })
      .where(eq(codeFilesTable.id, fileId))
      .returning()
      .execute();

    // Extract and save functions/methods from the code
    const functions = extractFunctions(existingFile.content, existingFile.language);
    
    if (functions.length > 0) {
      // Insert extracted functions
      const functionInputs = functions.map(func => ({
        file_id: fileId,
        name: func.name,
        signature: func.signature,
        line_start: func.line_start,
        line_end: func.line_end
      }));

      await db.insert(codeFunctionsTable)
        .values(functionInputs)
        .execute();
    }

    // Convert numeric fields back to numbers before returning
    const updatedFile = updatedFiles[0];
    return {
      ...updatedFile,
      complexity_score: updatedFile.complexity_score ? parseFloat(updatedFile.complexity_score) : null
    };
  } catch (error) {
    console.error('Code file analysis failed:', error);
    throw error;
  }
};

// Simple AI summary generation based on file content and language
function generateAISummary(content: string, language: string | null): string {
  const lines = content.split('\n').length;
  const hasImports = content.includes('import') || content.includes('require');
  const hasExports = content.includes('export') || content.includes('module.exports');
  const hasClasses = content.includes('class ') || content.includes('interface ');
  const hasFunctions = content.includes('function ') || content.includes('const ') || content.includes('let ');
  
  let summary = `This ${language || 'code'} file contains ${lines} lines. `;
  
  if (hasImports) summary += 'It includes external dependencies. ';
  if (hasExports) summary += 'It exports functionality for use by other modules. ';
  if (hasClasses) summary += 'It defines classes or interfaces. ';
  if (hasFunctions) summary += 'It contains function definitions. ';
  
  return summary.trim();
}

// Simple complexity calculation based on various code metrics
function calculateComplexityScore(content: string): number {
  let complexity = 1; // Base complexity
  
  // Add complexity for control flow
  complexity += (content.match(/if\s*\(/g) || []).length;
  complexity += (content.match(/for\s*\(/g) || []).length;
  complexity += (content.match(/while\s*\(/g) || []).length;
  complexity += (content.match(/switch\s*\(/g) || []).length;
  complexity += (content.match(/catch\s*\(/g) || []).length;
  
  // Add complexity for nested structures
  const braceDepth = calculateMaxBraceDepth(content);
  complexity += braceDepth * 0.5;
  
  // Add complexity for function count
  const functionCount = (content.match(/function\s+\w+/g) || []).length;
  complexity += functionCount * 0.3;
  
  return Math.round(complexity * 100) / 100; // Round to 2 decimal places
}

// Calculate maximum nesting depth
function calculateMaxBraceDepth(content: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (content[i] === '}') {
      currentDepth--;
    }
  }
  
  return maxDepth;
}

// Extract functions from code content
function extractFunctions(content: string, language: string | null): Array<{
  name: string;
  signature: string;
  line_start: number;
  line_end: number;
}> {
  const functions: Array<{
    name: string;
    signature: string;
    line_start: number;
    line_end: number;
  }> = [];
  
  const lines = content.split('\n');
  
  // Simple function extraction for JavaScript/TypeScript-like languages
  if (language === 'javascript' || language === 'typescript' || !language) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match function declarations
      const functionMatch = line.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*\([^)]*\)/);
      if (functionMatch) {
        const name = functionMatch[3];
        const signature = line;
        const lineStart = i + 1;
        
        // Find function end (simplified - just look for next function or end of file)
        let lineEnd = lineStart;
        let braceCount = 0;
        let foundOpenBrace = false;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          for (const char of currentLine) {
            if (char === '{') {
              braceCount++;
              foundOpenBrace = true;
            } else if (char === '}') {
              braceCount--;
              if (foundOpenBrace && braceCount === 0) {
                lineEnd = j + 1;
                break;
              }
            }
          }
          if (foundOpenBrace && braceCount === 0) break;
        }
        
        functions.push({
          name,
          signature,
          line_start: lineStart,
          line_end: lineEnd
        });
      }
      
      // Match arrow functions assigned to variables
      const arrowMatch = line.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        const name = arrowMatch[3];
        const signature = line;
        
        functions.push({
          name,
          signature,
          line_start: i + 1,
          line_end: i + 1 // Arrow functions typically on single line or we'd need more complex parsing
        });
      }
    }
  }
  
  return functions;
}