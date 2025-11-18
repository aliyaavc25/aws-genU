import {  
    APIGatewayProxyEvent,  
    APIGatewayProxyResult,  
  } from 'aws-lambda';  
  import { getWebContentById } from './repositoryWebContent';  
    
  export const handler = async (  
    event: APIGatewayProxyEvent  
  ): Promise<APIGatewayProxyResult> => {  
    console.log('[getWebContentById] Received event:', event);  
    
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
    
      const contentId = event.pathParameters?.id;  
      if (!contentId) {  
        return {  
          statusCode: 400,  
          headers: {  
            'Content-Type': 'application/json',  
            'Access-Control-Allow-Origin': '*',  
          },  
          body: JSON.stringify({ message: 'Content ID is required' }),  
        };  
      }  
    
      const item = await getWebContentById(userId, contentId);  
    
      if (!item) {  
        return {  
          statusCode: 404,  
          headers: {  
            'Content-Type': 'application/json',  
            'Access-Control-Allow-Origin': '*',  
          },  
          body: JSON.stringify({ message: 'Content not found' }),  
        };  
      }  
    
      return {  
        statusCode: 200,  
        headers: {  
          'Content-Type': 'application/json',  
          'Access-Control-Allow-Origin': '*',  
        },  
        body: JSON.stringify(item),  
      };  
    } catch (error) {  
      console.error('[getWebContentById] Error:', error);  
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