import {  
    APIGatewayProxyEvent,  
    APIGatewayProxyResult,  
  } from 'aws-lambda';  
  import { saveWebContent } from './repositoryWebContent';  
  import { parse } from 'node-html-parser';  
    
  interface BatchExtractRequest {  
    urls: string[];  
    context?: string;  
    modelId: string;  
  }  
    
  interface BatchExtractResult {  
    url: string;  
    status: 'completed' | 'failed';  
    extractedContent?: string;  
    rawText?: string;  
    error?: string;  
    contentId?: string;  
  }  
    
  const isValidUrl = (url: string): boolean => {  
    try {  
      const urlObj = new URL(url);  
      // Block internal/private IPs  
      if (  
        urlObj.hostname === 'localhost' ||  
        urlObj.hostname.startsWith('127.') ||  
        urlObj.hostname.startsWith('192.168.') ||  
        urlObj.hostname.startsWith('10.') ||  
        urlObj.hostname.startsWith('172.')  
      ) {  
        return false;  
      }  
      // Only allow http/https  
      if (!['http:', 'https:'].includes(urlObj.protocol)) {  
        return false;  
      }  
      return true;  
    } catch {  
      return false;  
    }  
  };  
    
  const extractWebContent = async (url: string): Promise<{  
    rawText: string;  
    extractedContent: string;  
  }> => {  
    const response = await fetch(url);  
    if (!response.ok) {  
      throw new Error(`Failed to fetch URL: ${response.statusText}`);  
    }  
    
    const html = await response.text();  
    const root = parse(html);  
    
    // Remove script and style tags  
    root.querySelectorAll('script, style').forEach((el) => el.remove());  
    
    // Extract text from body  
    const body = root.querySelector('body');  
    const rawText = body?.text || root.text;  
    
    // Clean up whitespace  
    const extractedContent = rawText  
      .replace(/\s+/g, ' ')  
      .trim();  
    
    return { rawText, extractedContent };  
  };  
    
  export const handler = async (  
    event: APIGatewayProxyEvent  
  ): Promise<APIGatewayProxyResult> => {  
    console.log('[batchExtractWebContent] Received event:', event);  
    
    try {  
      const userId =  
        event.requestContext.authorizer?.claims['cognito:username'];  
      if (!userId) {  
        return {  
          statusCode: 401,  
          headers: {  
            'Content-Type': 'application/json',  
            'Access-Control-Allow-Origin': '*',  
          },  
          body: JSON.stringify({ message: 'Unauthorized' }),  
        };  
      }  
    
      const body: BatchExtractRequest = JSON.parse(event.body || '{}');  
      const { urls, context, modelId } = body;  
    
      if (!urls || !Array.isArray(urls) || urls.length === 0) {  
        return {  
          statusCode: 400,  
          headers: {  
            'Content-Type': 'application/json',  
            'Access-Control-Allow-Origin': '*',  
          },  
          body: JSON.stringify({ message: 'URLs array is required' }),  
        };  
      }  
    
      if (!modelId) {  
        return {  
          statusCode: 400,  
          headers: {  
            'Content-Type': 'application/json',  
            'Access-Control-Allow-Origin': '*',  
          },  
          body: JSON.stringify({ message: 'modelId is required' }),  
        };  
      }  
    
      const results: BatchExtractResult[] = [];  
    
      // Process URLs sequentially to avoid rate limiting  
      for (const url of urls) {  
        try {  
          // Validate URL  
          if (!isValidUrl(url)) {  
            results.push({  
              url,  
              status: 'failed',  
              error: 'Invalid or unsafe URL',  
            });  
            continue;  
          }  
    
          // Extract content  
          const { rawText, extractedContent } = await extractWebContent(url);  
    
          // Save to DynamoDB  
          const savedItem = await saveWebContent(  
            userId,  
            url,  
            extractedContent,  
            rawText,  
            modelId,  
            context,  
            'completed'  
          );  
    
          results.push({  
            url,  
            status: 'completed',  
            extractedContent,  
            rawText,  
            contentId: savedItem.SK,  
          });  
        } catch (error) {  
          console.error(`[batchExtractWebContent] Error processing ${url}:`, error);  
            
          // Save failed extraction to DynamoDB  
          const savedItem = await saveWebContent(  
            userId,  
            url,  
            '',  
            '',  
            modelId,  
            context,  
            'failed',  
            error instanceof Error ? error.message : 'Unknown error'  
          );  
    
          results.push({  
            url,  
            status: 'failed',  
            error: error instanceof Error ? error.message : 'Unknown error',  
            contentId: savedItem.SK,  
          });  
        }  
      }  
    
      return {  
        statusCode: 200,  
        headers: {  
          'Content-Type': 'application/json',  
          'Access-Control-Allow-Origin': '*',  
        },  
        body: JSON.stringify({ results }),  
      };  
    } catch (error) {  
      console.error('[batchExtractWebContent] Error:', error);  
      return {  
        statusCode: 500,  
        headers: {  
          'Content-Type': 'application/json',  
          'Access-Control-Allow-Origin': '*',  
        },  
        body: JSON.stringify({  
          message: error instanceof Error ? error.message : 'Internal server error',  
        }),  
      };  
    }  
  };