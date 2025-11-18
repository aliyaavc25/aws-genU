import {  
    APIGatewayProxyEvent,  
    APIGatewayProxyResult,  
  } from 'aws-lambda';  
  import { listWebContent } from './repositoryWebContent';  
    
  export const handler = async (  
    event: APIGatewayProxyEvent  
  ): Promise<APIGatewayProxyResult> => {  
    console.log('[listWebContent] Received event:', event);  
    
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
    
      const exclusiveStartKey = event.queryStringParameters?.exclusiveStartKey  
        ? JSON.parse(  
            Buffer.from(  
              event.queryStringParameters.exclusiveStartKey,  
              'base64'  
            ).toString()  
          )  
        : undefined;  
    
      const limit = event.queryStringParameters?.limit  
        ? parseInt(event.queryStringParameters.limit, 10)  
        : 50;  
    
      const { items, lastEvaluatedKey } = await listWebContent(  
        userId,  
        limit,  
        exclusiveStartKey  
      );  
    
      return {  
        statusCode: 200,  
        headers: {  
          'Content-Type': 'application/json',  
          'Access-Control-Allow-Origin': '*',  
        },  
        body: JSON.stringify({  
          data: items,  
          lastEvaluatedKey: lastEvaluatedKey  
            ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')  
            : undefined,  
        }),  
      };  
    } catch (error) {  
      console.error('[listWebContent] Error:', error);  
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