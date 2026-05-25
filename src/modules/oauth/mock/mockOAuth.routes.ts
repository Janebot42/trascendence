import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Store mock authorization codes and tokens in memory for testing
interface MockAuthCode {
  code: string;
  state: string;
  clientId: string;
  redirectUri: string;
  expiresAt: Date;
}

interface MockAccessToken {
  token: string;
  authCode: string;
  expiresAt: Date;
}

const mockAuthCodes = new Map<string, MockAuthCode>();
const mockAccessTokens = new Map<string, MockAccessToken>();

// Generate a simple mock user profile
function generateMockProfile(token: string) {
  // Extract a number from the token to create consistent but varied mock data
  const hash = token.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    id: hash,
    login: `mock_user_${hash % 10000}`,
    email: `mock_user_${hash % 10000}@example.com`,
    displayname: `Mock User ${hash % 10000}`,
    image: {
      link: `https://api.intra.42.fr/mock/avatar/${hash}`
    },
    'staff?': false,
    correctionpoint: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function registerMockOAuthRoutes(app: FastifyInstance) {
  // Mock OAuth Authorization endpoint
  app.get('/mock/oauth/42/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { 
      client_id?: string; 
      redirect_uri?: string; 
      response_type?: string; 
      state?: string 
    };

    // Validate basic parameters
    if (!query.client_id || !query.redirect_uri || query.response_type !== 'code' || !query.state) {
      return reply.status(400).send({ 
        error: 'invalid_request', 
        error_description: 'Missing required parameters' 
      });
    }

    // Generate a mock authorization code
    const authCode = `mock_auth_code_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store the auth code
    mockAuthCodes.set(authCode, {
      code: authCode,
      state: query.state,
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    // Redirect back to the callback URL with the code and state
    const redirectUrl = new URL(query.redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    redirectUrl.searchParams.set('state', query.state);
    
    return reply.redirect(redirectUrl.toString());
  });

  // Mock OAuth Token endpoint
  app.post('/mock/oauth/42/token', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, string> | undefined;
    
    if (!body || body.grant_type !== 'authorization_code' || !body.code || !body.client_secret) {
      return reply.status(400).send({ 
        error: 'invalid_request', 
        error_description: 'Missing required parameters' 
      });
    }

    // Find and validate the auth code
    const authCodeRecord = mockAuthCodes.get(body.code);
    if (!authCodeRecord) {
      return reply.status(400).send({ 
        error: 'invalid_grant', 
        error_description: 'Invalid or expired authorization code' 
      });
    }

    // Check if code has expired
    if (authCodeRecord.expiresAt < new Date()) {
      mockAuthCodes.delete(body.code);
      return reply.status(400).send({ 
        error: 'invalid_grant', 
        error_description: 'Authorization code has expired' 
      });
    }

    // Delete the used auth code (one-time use)
    mockAuthCodes.delete(body.code);

    // Generate an access token
    const accessToken = `mock_access_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store the access token
    mockAccessTokens.set(accessToken, {
      token: accessToken,
      authCode: body.code,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    });

    return reply.send({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 7200,
      scope: 'public'
    });
  });

  // Mock OAuth Me/User Info endpoint
  app.get('/mock/oauth/42/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ 
        error: 'unauthorized', 
        error_description: 'Missing or invalid authorization header' 
      });
    }

    const accessToken = authHeader.substring(7);
    const tokenRecord = mockAccessTokens.get(accessToken);

    if (!tokenRecord) {
      return reply.status(401).send({ 
        error: 'unauthorized', 
        error_description: 'Invalid or expired access token' 
      });
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      mockAccessTokens.delete(accessToken);
      return reply.status(401).send({ 
        error: 'unauthorized', 
        error_description: 'Access token has expired' 
      });
    }

    // Return mock user profile
    return reply.send(generateMockProfile(accessToken));
  });
}
