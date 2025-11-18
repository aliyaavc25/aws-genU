import {  
    APIGatewayProxyEvent,  
    APIGatewayProxyResult,  
  } from 'aws-lambda';  
  import { deleteWebContent } from './repositoryWebContent';  
    
  export const handler = async (  
    event: APIGatewayProxyEvent  
  ): Promise<APIGatewayProxyResult> => {  
    console.log('[deleteWebContent] Received event:', event);  
    
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
    
      await deleteWebContent(userId, contentId);  
    
      return {  
        statusCode: 200,  
        headers: {  
          'Content-Type': 'application/json',  
          'Access-Control-Allow-Origin': '*',  
        },  
        body: JSON.stringify({ message: 'Content deleted successfully' }),  
      };  
    } catch (error) {  
      console.error('[deleteWebContent] Error:', error);  
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