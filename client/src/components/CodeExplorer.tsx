import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { Repository, CodeFile, CodeFunction, CodeIssue, CreateCodeFileInput } from '../../../server/src/schema';

interface CodeExplorerProps {
  repository: Repository;
}

export function CodeExplorer({ repository }: CodeExplorerProps) {
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [fileFunctions, setFileFunctions] = useState<CodeFunction[]>([]);
  const [codeIssues, setCodeIssues] = useState<CodeIssue[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // Create new file form state
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFileData, setNewFileData] = useState<CreateCodeFileInput>({
    repository_id: repository.id,
    path: '',
    content: '',
    language: null,
    size: 0
  });

  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    setError(null);
    try {
      const result = await trpc.getRepositoryFiles.query({ repositoryId: repository.id });
      setFiles(result);
    } catch (error) {
      console.error('Failed to load files:', error);
      setError('Failed to load repository files');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [repository.id]);

  const loadCodeIssues = useCallback(async () => {
    try {
      const result = await trpc.getCodeIssues.query({ repositoryId: repository.id });
      setCodeIssues(result);
    } catch (error) {
      console.error('Failed to load code issues:', error);
    }
  }, [repository.id]);

  useEffect(() => {
    loadFiles();
    loadCodeIssues();
  }, [loadFiles, loadCodeIssues]);

  const handleFileSelect = async (file: CodeFile) => {
    setSelectedFile(file);
    try {
      const functions = await trpc.getFileFunctions.query({ fileId: file.id });
      setFileFunctions(functions);
    } catch (error) {
      console.error('Failed to load file functions:', error);
      setFileFunctions([]);
    }
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    try {
      await trpc.analyzeCodeFile.mutate({ fileId: selectedFile.id });
      // Refresh files to get updated analysis
      await loadFiles();
      // Update selected file if it was analyzed
      const updatedFile = files.find((f: CodeFile) => f.id === selectedFile.id);
      if (updatedFile) {
        setSelectedFile(updatedFile);
      }
    } catch (error) {
      console.error('Failed to analyze file:', error);
      setError('Failed to analyze file');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingFile(true);
    setError(null);
    
    try {
      const fileData = {
        ...newFileData,
        size: new Blob([newFileData.content]).size
      };
      
      const result = await trpc.createCodeFile.mutate(fileData);
      setFiles((prev: CodeFile[]) => [...prev, result]);
      setShowCreateForm(false);
      setNewFileData({
        repository_id: repository.id,
        path: '',
        content: '',
        language: null,
        size: 0
      });
    } catch (error) {
      console.error('Failed to create file:', error);
      setError('Failed to create file');
    } finally {
      setIsCreatingFile(false);
    }
  };

  const filteredFiles = files.filter((file: CodeFile) =>
    file.path.toLowerCase().includes(filter.toLowerCase()) ||
    (file.language && file.language.toLowerCase().includes(filter.toLowerCase()))
  );

  const getLanguageColor = (language: string | null) => {
    if (!language) return 'bg-gray-500';
    const colors: Record<string, string> = {
      typescript: 'bg-blue-500',
      javascript: 'bg-yellow-500',
      python: 'bg-green-500',
      java: 'bg-red-500',
      cpp: 'bg-purple-500',
      csharp: 'bg-purple-600',
      go: 'bg-cyan-500',
      rust: 'bg-orange-500',
      php: 'bg-indigo-500'
    };
    return colors[language.toLowerCase()] || 'bg-gray-500';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      critical: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
      {/* File List Panel */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">📁 Files</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                ➕ Add File
              </Button>
            </div>
            <Input
              placeholder="Filter files..."
              value={filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <Alert className="m-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
            
            {showCreateForm && (
              <div className="p-4 border-b bg-muted/50">
                <form onSubmit={handleCreateFile} className="space-y-3">
                  <Input
                    placeholder="File path (e.g., src/components/App.tsx)"
                    value={newFileData.path}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewFileData((prev: CreateCodeFileInput) => ({ 
                        ...prev, 
                        path: e.target.value 
                      }))
                    }
                    required
                  />
                  <Input
                    placeholder="Language (optional)"
                    value={newFileData.language || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewFileData((prev: CreateCodeFileInput) => ({ 
                        ...prev, 
                        language: e.target.value || null 
                      }))
                    }
                  />
                  <Textarea
                    placeholder="File content..."
                    value={newFileData.content}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewFileData((prev: CreateCodeFileInput) => ({ 
                        ...prev, 
                        content: e.target.value 
                      }))
                    }
                    rows={4}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={isCreatingFile}>
                      {isCreatingFile ? 'Creating...' : 'Create'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <ScrollArea className="h-[600px]">
              {isLoadingFiles ? (
                <div className="p-4 text-center">
                  <div className="inline-flex items-center gap-2">
                    🔄 Loading files...
                  </div>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {filter ? 'No files match your filter' : 'No files found'}
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {filteredFiles.map((file: CodeFile) => (
                    <div
                      key={file.id}
                      className={`p-3 rounded cursor-pointer transition-colors ${
                        selectedFile?.id === file.id 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleFileSelect(file)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{file.path}</span>
                        {file.language && (
                          <Badge 
                            className={`text-white text-xs ${getLanguageColor(file.language)}`}
                          >
                            {file.language}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{(file.size / 1024).toFixed(1)}KB</span>
                        {file.complexity_score && (
                          <span>Complexity: {file.complexity_score.toFixed(1)}</span>
                        )}
                      </div>
                      {file.ai_summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {file.ai_summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* File Details Panel */}
      <div className="lg:col-span-2">
        {selectedFile ? (
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  📄 {selectedFile.path}
                  {selectedFile.language && (
                    <Badge className={`text-white ${getLanguageColor(selectedFile.language)}`}>
                      {selectedFile.language}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  onClick={handleAnalyzeFile}
                  disabled={isAnalyzing}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isAnalyzing ? '🔄 Analyzing...' : '🤖 AI Analyze'}
                </Button>
              </div>
              <CardDescription>
                {(selectedFile.size / 1024).toFixed(1)}KB • Last updated: {selectedFile.last_updated.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="content" className="h-[650px]">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="summary">AI Summary</TabsTrigger>
                  <TabsTrigger value="functions">Functions</TabsTrigger>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="mt-4">
                  <ScrollArea className="h-[580px] w-full rounded border">
                    <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                      {selectedFile.content}
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="summary" className="mt-4 space-y-4">
                  {selectedFile.ai_summary ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-medium mb-2">🤖 AI Summary</h4>
                        <p className="text-sm">{selectedFile.ai_summary}</p>
                      </div>
                      {selectedFile.complexity_score && (
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <h4 className="font-medium mb-2">📊 Complexity Analysis</h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Complexity Score</span>
                              <Badge variant="outline">
                                {selectedFile.complexity_score.toFixed(1)}/10
                              </Badge>
                            </div>
                            <Progress 
                              value={selectedFile.complexity_score * 10} 
                              className="h-2"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">🤖</div>
                      <h3 className="text-lg font-medium mb-2">No AI Analysis Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Click "AI Analyze" to generate a summary and complexity analysis
                      </p>
                      <Button
                        onClick={handleAnalyzeFile}
                        disabled={isAnalyzing}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isAnalyzing ? '🔄 Analyzing...' : '🤖 Analyze Now'}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="functions" className="mt-4">
                  <ScrollArea className="h-[580px]">
                    {fileFunctions.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-4xl mb-4">🔧</div>
                        <h3 className="text-lg font-medium mb-2">No Functions Found</h3>
                        <p className="text-muted-foreground">
                          No functions or methods detected in this file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {fileFunctions.map((func: CodeFunction) => (
                          <div key={func.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{func.name}</h4>
                              <Badge variant="outline">
                                Lines {func.line_start}-{func.line_end}
                              </Badge>
                            </div>
                            <pre className="text-sm font-mono bg-muted p-2 rounded mb-2">
                              {func.signature}
                            </pre>
                            {func.ai_explanation && (
                              <p className="text-sm text-muted-foreground">
                                {func.ai_explanation}
                              </p>
                            )}
                            {func.complexity_score && (
                              <div className="mt-2">
                                <Badge variant="secondary">
                                  Complexity: {func.complexity_score.toFixed(1)}
                                </Badge>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="issues" className="mt-4">
                  <ScrollArea className="h-[580px]">
                    {codeIssues.filter((issue: CodeIssue) => issue.file_id === selectedFile.id).length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-4xl mb-4">✅</div>
                        <h3 className="text-lg font-medium mb-2">No Issues Found</h3>
                        <p className="text-muted-foreground">
                          No code issues detected in this file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {codeIssues
                          .filter((issue: CodeIssue) => issue.file_id === selectedFile.id)
                          .map((issue: CodeIssue) => (
                            <div key={issue.id} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={getSeverityColor(issue.severity)}>
                                  {issue.severity.toUpperCase()}
                                </Badge>
                                <Badge variant="outline">
                                  {issue.issue_type}
                                </Badge>
                              </div>
                              {issue.line_number && (
                                <p className="text-sm font-mono mb-2">
                                  Line {issue.line_number}
                                </p>
                              )}
                              <p className="text-sm mb-2">{issue.description}</p>
                              {issue.suggestion && (
                                <div className="p-2 bg-green-50 rounded border border-green-200">
                                  <p className="text-sm text-green-800">
                                    💡 {issue.suggestion}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="text-6xl">👈</div>
                <h3 className="text-xl font-medium">Select a File</h3>
                <p className="text-muted-foreground">
                  Choose a file from the list to view its contents and analysis
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}