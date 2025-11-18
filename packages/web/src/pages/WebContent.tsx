import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import RowItem from '../components/RowItem';
import ExpandableField from '../components/ExpandableField';
import Textarea from '../components/Textarea';
import Markdown from '../components/Markdown';
import ButtonCopy from '../components/ButtonCopy';
import Alert from '../components/Alert';
import Select from '../components/Select';
import useChat from '../hooks/useChat';
import useChatApi from '../hooks/useChatApi';
import useTyping from '../hooks/useTyping';
import { create } from 'zustand';
import { WebContentPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import queryString from 'query-string';
import InputText from '../components/InputText';
import { useTranslation } from 'react-i18next';
import { PiPlus, PiTrash, PiClock, PiCheck, PiX } from 'react-icons/pi';

type StateType = {  
  urls: string[];  // Changed from single url to array  
  setUrls: (urls: string[]) => void;  
  addUrl: () => void;  // New  
  removeUrl: (index: number) => void;  // New  
  updateUrl: (index: number, value: string) => void;  // New  
  fetching: boolean;  
  setFetching: (b: boolean) => void;  
  text: string;  
  setText: (s: string) => void;  
  context: string;  
  setContext: (s: string) => void;  
  content: string;  
  setContent: (s: string) => void;  
  batchResults: Map<string, { status: string; content: string; error?: string }>;  // New  
  setBatchResults: (results: Map<string, { status: string; content: string; error?: string }>) => void;  // New  
  showHistory: boolean;  // New  
  setShowHistory: (b: boolean) => void;  // New  
  history: any[];  // New  
  setHistory: (items: any[]) => void;  // New  
  clear: () => void;  
};

const useWebContentPageState = create<StateType>((set) => {  
  const INIT_STATE = {  
    urls: [''],  // Changed to array with one empty string  
    fetching: false,  
    text: '',  
    context: '',  
    content: '',  
    batchResults: new Map(),  // New  
    showHistory: false,  // New  
    history: [],  // New  
  };  
  return {  
    ...INIT_STATE,  
    setUrls: (urls: string[]) => {  
      set(() => ({ urls }));  
    },  
    addUrl: () => {  // New  
      set((state) => ({ urls: [...state.urls, ''] }));  
    },  
    removeUrl: (index: number) => {  // New  
      set((state) => ({  
        urls: state.urls.filter((_, i) => i !== index),  
      }));  
    },  
    updateUrl: (index: number, value: string) => {  // New  
      set((state) => {  
        const newUrls = [...state.urls];  
        newUrls[index] = value;  
        return { urls: newUrls };  
      });  
    },  
    setBatchResults: (results) => {  // New  
      set(() => ({ batchResults: results }));  
    },  
    setShowHistory: (b: boolean) => {  // New  
      set(() => ({ showHistory: b }));  
    },  
    setHistory: (items: any[]) => {  // New  
      set(() => ({ history: items }));  
    },  
    setFetching: (b: boolean) => {
      set(() => ({
        fetching: b,
      }));
    },
    setText: (s: string) => {
      set(() => ({
        text: s,
      }));
    },
    setContext: (s: string) => {
      set(() => ({
        context: s,
      }));
    },
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
    clear: () => {
      set(INIT_STATE);
    },
  };
});

const WebContent: React.FC = () => {
  const { t } = useTranslation();
  const {  
    urls,  // Changed  
    setUrls,  // Changed  
    addUrl,  // New  
    removeUrl,  // New  
    updateUrl,  // New  
    fetching,  
    setFetching,  
    text,  
    setText,  
    context,  
    setContext,  
    content,  
    setContent,  
    batchResults,  // New  
    setBatchResults,  // New  
    showHistory,  // New  
    setShowHistory,  // New  
    history,  // New  
    setHistory,  // New  
    clear,  
  } = useWebContentPageState();

  const { pathname, search } = useLocation();
  const {
    getModelId,
    setModelId,
    loading,
    messages,
    postChat,
    continueGeneration,
    clear: clearChat,
    updateSystemContextByModel,
    getStopReason,
  } = useChat(pathname);
  const { setTypingTextInput, typingTextOutput } = useTyping(loading);
  const { getWebText } = useChatApi();
  const [showError, setShowError] = useState(false);
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const stopReason = getStopReason();

  useEffect(() => {
    updateSystemContextByModel();
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  const disabledExec = useMemo(() => {  
    return urls.every(url => url === '') || loading || fetching;  // Check all URLs  
  }, [urls, loading, fetching]);

  useEffect(() => {  
    const _modelId = !modelId ? availableModels[0] : modelId;  
    if (search !== '') {  
      const params = queryString.parse(search) as WebContentPageQueryParams;  
      if (params.url) {  
        setUrls([params.url]);  // Wrap in array  
      }  
      setContext(params.context ?? '');  
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {  
      setModelId(_modelId);  
    }  
  }, [modelId, availableModels, search]);

  useEffect(() => {
    setTypingTextInput(content);
  }, [content, setTypingTextInput]);

  const getContent = useCallback(
    (text: string, context: string) => {
      postChat(
        prompter.webContentPrompt({
          text,
          context,
        }),
        true
      );
    },
    [prompter, postChat]
  );

  const onClickExec = useCallback(async () => {
    if (loading || fetching) return;
    setContent('');
    setFetching(true);
    setShowError(false);

    let res;

    try {
      res = await getWebText({ url });
    } catch (e) {
      setFetching(false);
      setShowError(true);
      return;
    }

    setFetching(false);

    const text = res!.data.text;

    setText(text);
    getContent(text, context);
  }, [
    url,
    context,
    loading,
    fetching,
    setContent,
    setFetching,
    setText,
    getContent,
    getWebText,
  ]);
  // Batch URL extraction (new functionality)  
  const onClickBatchExec = useCallback(async () => {  
    if (loading || fetching) return;  
    setFetching(true);  
    setShowError(false);  
    setBatchResults(new Map());  
    
    const validUrls = urls.filter(url => url.trim() !== '');  
      
    try {  
      const response = await fetch('/web-text/batch', {  
        method: 'POST',  
        headers: {  
          'Content-Type': 'application/json',  
        },  
        body: JSON.stringify({  
          urls: validUrls,  
          context,  
          modelId,  
        }),  
      });  
    
      if (!response.ok) {  
        throw new Error('Batch extraction failed');  
      }  
    
      const data = await response.json();  
      const resultsMap = new Map();  
        
      data.results.forEach((result: any) => {  
        resultsMap.set(result.url, {  
          status: result.status,  
          content: result.extractedContent || '',  
          error: result.error,  
        });  
      });  
    
      setBatchResults(resultsMap);  
    } catch (e) {  
      setShowError(true);  
    } finally {  
      setFetching(false);  
    }  
  }, [urls, context, modelId, loading, fetching, setBatchResults]);

  // Load history  
  const loadHistory = useCallback(async () => {  
    try {  
      const response = await fetch('/web-text/history');  
      if (!response.ok) {  
        throw new Error('Failed to load history');  
      }  
      const data = await response.json();  
      setHistory(data.data || []);  
      setShowHistory(true);  
    } catch (e) {  
      console.error('Failed to load history:', e);  
    }  
  }, [setHistory, setShowHistory]);  
    
  // Delete history item  
  const deleteHistoryItem = useCallback(async (contentId: string) => {  
    try {  
      const response = await fetch(`/web-text/${contentId}`, {  
        method: 'DELETE',  
      });  
      if (!response.ok) {  
        throw new Error('Failed to delete item');  
      }  
      await loadHistory();  
    } catch (e) {  
      console.error('Failed to delete item:', e);  
    }  
  }, [loadHistory]);

  useEffect(() => {
    if (messages.length === 0) return;
    const _lastMessage = messages[messages.length - 1];
    if (_lastMessage.role !== 'assistant') return;
    const _response = messages[messages.length - 1].content;
    setContent(_response.trim());
  }, [messages, setContent]);

  const onClickClear = useCallback(() => {
    setShowError(false);
    clear();
    clearChat();
  }, [clear, clearChat]);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('webcontent.title')}
      </div>

      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        {showError && (
          <Alert
            severity="error"
            className="mb-3"
            title={t('common.error')}
            onDissmiss={() => {
              setShowError(false);
            }}>
            {t('webcontent.error_message')}
          </Alert>
        )}

        <Card label={t('webcontent.website_to_extract')}>
        <div className="mb-2 flex w-full justify-between">  
          <Select  
            value={modelId}  
            onChange={setModelId}  
            options={availableModels.map((m) => {  
              return { value: m, label: modelDisplayName(m) };  
            })}  
          />  
          <Button outlined onClick={loadHistory}>  
            <PiClock className="mr-2" />  
            View History  
          </Button>  
        </div>

          <div className="text-xs text-black/50">
            {t('webcontent.instruction')}
          </div>

          {/* Multiple URL inputs */}  
          {urls.map((url, index) => (  
            <RowItem key={index} className="mt-2">  
              <div className="flex gap-2 w-full">  
                <InputText  
                  className="flex-1"  
                  placeholder={t('webcontent.enter_url')}  
                  value={url}  
                  onChange={(value) => updateUrl(index, value)}  
                />  
                {urls.length > 1 && (  
                  <Button  
                    outlined  
                    onClick={() => removeUrl(index)}  
                    className="px-2">  
                    <PiTrash />  
                  </Button>  
                )}  
              </div>  
            </RowItem>  
          ))}  
            
          <div className="mt-2">  
            <Button outlined onClick={addUrl} className="w-full">  
              <PiPlus className="mr-2" />  
              Add URL  
            </Button>  
          </div>

          <ExpandableField label={t('webcontent.additional_context')} optional>
            <Textarea
              placeholder={t('webcontent.additional_context_placeholder')}
              value={context}
              onChange={setContext}
            />
          </ExpandableField>

          <div className="flex justify-end gap-3">
            {stopReason === 'max_tokens' && (
              <Button onClick={continueGeneration}>
                {t('translate.continue_output')}
              </Button>
            )}

            <Button outlined onClick={onClickClear} disabled={disabledExec}>
              {t('common.clear')}
            </Button>

            {urls.length === 1 ? (  
              <Button disabled={disabledExec} onClick={onClickExec}>  
                {t('common.execute')}  
              </Button>  
            ) : (  
              <Button disabled={disabledExec} onClick={onClickBatchExec}>  
                Batch Extract  
              </Button>  
            )}
          </div>

          <div className="mt-2 rounded border border-black/30 p-1.5">
            <Markdown>{typingTextOutput}</Markdown>
            {!loading && !fetching && content === '' && (
              <div className="text-gray-500">
                {t('webcontent.result_placeholder')}
              </div>
            )}
            {(loading || fetching) && (
              <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
            )}
            <div className="flex w-full justify-end">
              <ButtonCopy
                text={content}
                interUseCasesKey="content"></ButtonCopy>
            </div>
          </div>

          <ExpandableField
            label={t('webcontent.original_text', {
              status: fetching
                ? t('webcontent.loading')
                : text === ''
                  ? t('webcontent.not_fetched')
                  : t('webcontent.fetched'),
            })}
            className="mt-2">
            <div className="rounded border border-black/30 p-1.5">
              {text === '' && (
                <div className="text-gray-500">
                  {t('webcontent.not_fetched_instruction')}
                </div>
              )}
              {text}
              <div className="flex w-full justify-end">
                <ButtonCopy text={text}></ButtonCopy>
              </div>
            </div>
          </ExpandableField>
        </Card>
        {/* Batch results display */}  
        {urls.length > 1 && batchResults.size > 0 && (  
          <div className="mt-4">  
            <h3 className="text-lg font-semibold mb-2">Extraction Results</h3>  
            <div className="space-y-2">  
              {Array.from(batchResults.entries()).map(([url, result]) => (  
                <div key={url} className="border rounded p-3">  
                  <div className="flex items-center gap-2 mb-2">  
                    {result.status === 'completed' ? (  
                      <PiCheck className="text-green-600" />  
                    ) : (  
                      <PiX className="text-red-600" />  
                    )}  
                    <span className="font-medium truncate">{url}</span>  
                  </div>  
                  {result.status === 'completed' ? (  
                    <div className="text-sm">  
                      <Markdown>{result.content.substring(0, 200)}...</Markdown>  
                    </div>  
                  ) : (  
                    <div className="text-sm text-red-600">{result.error}</div>  
                  )}  
                </div>  
              ))}  
            </div>  
          </div>  
        )}  
          
        {/* History modal */}  
        {showHistory && (  
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">  
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">  
              <div className="flex justify-between items-center mb-4">  
                <h2 className="text-xl font-semibold">Extraction History</h2>  
                <Button outlined onClick={() => setShowHistory(false)}>  
                  Close  
                </Button>  
              </div>  
              <div className="space-y-3">  
                {history.map((item) => (  
                  <div key={item.SK} className="border rounded p-3">  
                    <div className="flex justify-between items-start">  
                      <div className="flex-1">  
                        <div className="font-medium">{item.url}</div>  
                        <div className="text-sm text-gray-500">  
                          {new Date(item.createdAt).toLocaleString()}  
                        </div>  
                      </div>  
                      <Button  
                        outlined  
                        onClick={() => deleteHistoryItem(item.SK)}  
                        className="px-2">  
                        <PiTrash />  
                      </Button>  
                    </div>  
                  </div>  
                ))}  
              </div>  
            </div>  
          </div>  
        )}
      </div>
    </div>
  );
};

export default WebContent;
