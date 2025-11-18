import { DynamoDBClient } from '@aws-sdk/client-dynamodb';  
import {  
  DynamoDBDocumentClient,  
  PutCommand,  
  QueryCommand,  
  GetCommand,  
  DeleteCommand,  
} from '@aws-sdk/lib-dynamodb';  
import { createHash } from 'crypto';  
  
const client = new DynamoDBClient({});  
const docClient = DynamoDBDocumentClient.from(client);  
  
const TABLE_NAME = process.env.WEB_CONTENT_TABLE_NAME!;  
  
export interface WebContentItem {  
  PK: string;  
  SK: string;  
  url: string;  
  extractedContent: string;  
  rawText: string;  
  context?: string;  
  modelId: string;  
  createdAt: number;  
  status: 'completed' | 'failed';  
  error?: string;  
}  
  
export const saveWebContent = async (  
  userId: string,  
  url: string,  
  extractedContent: string,  
  rawText: string,  
  modelId: string,  
  context?: string,  
  status: 'completed' | 'failed' = 'completed',  
  error?: string  
): Promise<WebContentItem> => {  
  const timestamp = Date.now();  
  const urlHash = createHash('md5').update(url).digest('hex').substring(0, 8);  
  
  const item: WebContentItem = {  
    PK: `webContent#${userId}`,  
    SK: `${timestamp}#${urlHash}`,  
    url,  
    extractedContent,  
    rawText,  
    context,  
    modelId,  
    createdAt: timestamp,  
    status,  
    error,  
  };  
  
  await docClient.send(  
    new PutCommand({  
      TableName: TABLE_NAME,  
      Item: item,  
    })  
  );  
  
  return item;  
};  
  
export const listWebContent = async (  
  userId: string,  
  limit: number = 50,  
  exclusiveStartKey?: Record<string, any>  
): Promise<{  
  items: WebContentItem[];  
  lastEvaluatedKey?: Record<string, any>;  
}> => {  
  const response = await docClient.send(  
    new QueryCommand({  
      TableName: TABLE_NAME,  
      KeyConditionExpression: 'PK = :pk',  
      ExpressionAttributeValues: {  
        ':pk': `webContent#${userId}`,  
      },  
      ScanIndexForward: false, // Most recent first  
      Limit: limit,  
      ExclusiveStartKey: exclusiveStartKey,  
    })  
  );  
  
  return {  
    items: (response.Items || []) as WebContentItem[],  
    lastEvaluatedKey: response.LastEvaluatedKey,  
  };  
};  
  
export const getWebContentById = async (  
  userId: string,  
  sortKey: string  
): Promise<WebContentItem | null> => {  
  const response = await docClient.send(  
    new GetCommand({  
      TableName: TABLE_NAME,  
      Key: {  
        PK: `webContent#${userId}`,  
        SK: sortKey,  
      },  
    })  
  );  
  
  return (response.Item as WebContentItem) || null;  
};  
  
export const deleteWebContent = async (  
  userId: string,  
  sortKey: string  
): Promise<void> => {  
  await docClient.send(  
    new DeleteCommand({  
      TableName: TABLE_NAME,  
      Key: {  
        PK: `webContent#${userId}`,  
        SK: sortKey,  
      },  
    })  
  );  
};