import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import type { Repository, AiAnalysisResponse, NaturalLanguageQueryInput } from '../../../server/src/schema';

interface AIAssistantProps {
  repository: Repository;
}

interface QueryHistory {
  question: string;
  response: AiAnalysisResponse;
  timestamp: Date;
}

export function AIAssistant({ repository }: AIAssistantProps) {
  const [question, setQuestion] = useState('');
  const [currentResponse, setCurrentResponse] = useState<AiAnalysisResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Context files for more targeted queries
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [contextInput, setContextInput] = useState('');

  const handleQuery = useCallback(async (queryQuestion: string = question) => {
    if (!queryQuestion.trim()) return;

    setIsQuerying(true);
    setError(null);
    
    try {
      const queryInput: NaturalLanguageQueryInput = {
        repository_id: repository.id,
        question: queryQuestion.trim(),
        context_files: contextFiles.length > 0 ? contextFiles : undefined
      };

      const response = await trpc.naturalLanguageQuery.query(queryInput);
      setCurrentResponse(response);
      
      // Add to query history
      setQueryHistory((prev: QueryHistory[]) => [
        {
          question: queryQuestion.trim(),
          response,
          timestamp: new Date()
        },
        ...prev.slice(0, 9) // Keep last 10 queries
      ]);

      // Clear the question input
      setQuestion('');
    } catch (error) {
      console.error('Query failed:', error);
      setError('Failed to process your question. Please try again.');
      setCurrentResponse(null);
    } finally {
      setIsQuerying(false);
    }
  }, [question, repository.id, contextFiles]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery();
  };

  const addContextFile = () => {
    if (contextInput.trim() && !contextFiles.includes(contextInput.trim())) {
      setContextFiles((prev: string[]) => [...prev, contextInput.trim()]);
      setContextInput('');
    }
  };

  const removeContextFile = (file: string) => {
    setContextFiles((prev: string[]) => prev.filter((f: string) => f !== file));
  };

  const clearContext = () => {
    setContextFiles([]);
  };

  // Suggested questions based on repository type
  const suggestedQuestions = [
    "What is the main purpose of this codebase?",
    "What are the key components or modules?",
    "Are there any potential security issues?",
    "What are the main dependencies?",
    "How is error handling implemented?",
    "What patterns are used throughout the code?",
    "Are there any performance bottlenecks?",
    "What would be good areas for refactoring?"
  ];

  const getIssueTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      bug: 'bg-red-100 text-red-800 border-red-200',
      performance: 'bg-orange-100 text-orange-800 border-orange-200',
      security: 'bg-purple-100 text-purple-800 border-purple-200',
      style: 'bg-blue-100 text-blue-800 border-blue-200',
      maintainability: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Query Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🤖 AI Assistant
          </CardTitle>
          <CardDescription>
            Ask questions about {repository.name} in natural language
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Context Files */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Focus on specific files (optional):</Label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., src/main.ts, components/App.tsx"
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-md"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addContextFile();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContextFile}
                disabled={!contextInput.trim()}
              >
                Add
              </Button>
            </div>
            
            {contextFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {contextFiles.map((file: string) => (
                  <Badge
                    key={file}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeContextFile(file)}
                  >
                    {file} ×
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearContext}
                  className="text-xs h-6"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Query Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="question" className="text-sm font-medium">
                Your Question:
              </Label>
              <Textarea
                id="question"
                placeholder="Ask anything about the codebase... e.g., 'How does authentication work?' or 'What are the main security concerns?'"
                value={question}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isQuerying || !question.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isQuerying ? '🤔 Analyzing...' : '🚀 Ask AI'}
            </Button>
          </form>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Suggested Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💡 Suggested Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {suggestedQuestions.map((suggestedQuestion: string, index: number) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-left justify-start h-auto p-3"
                onClick={() => handleQuery(suggestedQuestion)}
                disabled={isQuerying}
              >
                <div className="text-xs">{suggestedQuestion}</div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Response */}
      {currentResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🎯 AI Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">📝 Summary</h4>
              <p className="text-blue-800 text-sm">{currentResponse.summary}</p>
            </div>

            {/* Key Functions */}
            {currentResponse.key_functions.length > 0 && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">⚡ Key Functions</h4>
                <div className="flex flex-wrap gap-2">
                  {currentResponse.key_functions.map((func: string, index: number) => (
                    <Badge key={index} variant="secondary" className="bg-green-100 text-green-800">
                      {func}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Potential Issues */}
            {currentResponse.potential_issues.length > 0 && (
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-900 mb-2">⚠️ Potential Issues</h4>
                <ul className="space-y-1">
                  {currentResponse.potential_issues.map((issue: string, index: number) => (
                    <li key={index} className="text-orange-800 text-sm flex items-start gap-2">
                      <span className="text-orange-600 mt-1">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {currentResponse.suggestions.length > 0 && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">💡 Suggestions</h4>
                <ul className="space-y-1">
                  {currentResponse.suggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="text-purple-800 text-sm flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related Files */}
            {currentResponse.related_files.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">🔗 Related Files</h4>
                <div className="flex flex-wrap gap-2">
                  {currentResponse.related_files.map((file: string, index: number) => (
                    <Badge key={index} variant="outline" className="font-mono">
                      {file}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📚 Query History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {queryHistory.map((entry: QueryHistory, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">❓ {entry.question}</h4>
                      <Badge variant="outline" className="text-xs">
                        {entry.timestamp.toLocaleString()}
                      </Badge>
                    </div>
                    <Separator className="my-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {entry.response.summary}
                    </p>
                    {entry.response.key_functions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.response.key_functions.slice(0, 3).map((func: string, funcIndex: number) => (
                          <Badge key={funcIndex} variant="secondary" className="text-xs">
                            {func}
                          </Badge>
                        ))}
                        {entry.response.key_functions.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{entry.response.key_functions.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => setCurrentResponse(entry.response)}
                    >
                      View Full Response
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Welcome State */}
      {!currentResponse && queryHistory.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <div className="text-6xl">🤖</div>
              <h3 className="text-xl font-semibold">AI Assistant Ready</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Ask questions about your codebase in natural language. I can help you understand 
                architecture, identify issues, suggest improvements, and more!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}