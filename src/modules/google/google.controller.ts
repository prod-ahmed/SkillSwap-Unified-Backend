import { Controller, Get, Post, UseGuards, Query, Res, Headers, UnauthorizedException, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { GoogleService } from './google.service';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express'; // ✅ use 'import type'

@Controller('google')
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly jwtService: JwtService,
  ) {}

  // Get Google OAuth authorization URL
  // Supports both Authorization header (normal API calls) and token query param (Chrome Custom Tabs)
    @Get('auth')
  async getAuthUrl(
  @Query('token') token?: string,
    @Headers('authorization') authHeader?: string,
  @Res({ passthrough: true }) res?: Response,
  ) {
  let authToken: string | undefined;

  if (token) {
      authToken = token;
  } else if (authHeader) {
    authToken = authHeader.replace('Bearer ', '').trim();
  }

  if (!authToken) {
      return {
      message: 'Unauthorized',
      error: 'Token required. Provide ?token=... or Authorization header.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const decoded = this.jwtService.verify(authToken);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = decoded.userId || decoded.sub || decoded.id;
    if (!userId) {
        return {
          message: 'Unauthorized',
          error: 'Invalid token: userId missing',
        };
    }

    const authUrl = this.googleService.getAuthUrl(userId);

    // If res exists → redirect
    if (res) {
      res.redirect(authUrl);
      return;
    }

    // If not → return URL (Android Retrofit case)
    return { url: authUrl };
  } catch (e) {
    return { message: 'Unauthorized', error: e.message };
  }
}


  // Handle OAuth callback
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      await this.googleService.handleCallback(code, state);

      // Redirect directly to Android app via deep link
      // Use JavaScript redirect immediately (before page loads)
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script>
              // Immediate redirect - execute before page renders
              (function() {
                try {
                  // Redirect to deep link immediately
                  window.location.replace('skillswaptn://google/callback?success=true');
                  
                  // Fallback: try window.location.href
                  setTimeout(function() {
                    window.location.href = 'skillswaptn://google/callback?success=true';
                  }, 100);
                  
                  // Final fallback: try to close after 1 second
                  setTimeout(function() {
                    try {
                      window.close();
                    } catch(e) {
                      // Ignore
                    }
                  }, 1000);
                } catch(e) {
                  console.error('Redirect error:', e);
                }
              })();
            </script>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                display:flex; 
                justify-content:center; 
                align-items:center; 
                height:100vh; 
                margin:0; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              }
              .container { 
                text-align:center; 
                background:white; 
                padding:40px; 
                border-radius:16px; 
                box-shadow:0 10px 40px rgba(0,0,0,0.2); 
                max-width:400px; 
              }
              .success-icon { font-size:64px; margin-bottom:20px; }
              h1 { color:#333; margin-bottom:20px; }
              p { color:#666; line-height:1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Google Calendar Connected!</h1>
              <p>Redirecting back to the app...</p>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connection Failed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta http-equiv="refresh" content="0;url=skillswaptn://google/callback?success=false&error=${encodeURIComponent(error.message || 'Unknown error')}">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
              .container { text-align:center; background:white; padding:40px; border-radius:16px; box-shadow:0 10px 40px rgba(0,0,0,0.2); max-width:400px; }
              h1 { color:#333; margin-bottom:20px; }
              p { color:#666; line-height:1.6; }
              .error-icon { font-size:64px; margin-bottom:20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Connection Failed</h1>
              <p>Failed to connect Google Calendar. Please try again.</p>
              <p style="margin-top:20px; font-size:14px; color:#999;">Error: ${error.message || 'Unknown error'}</p>
            </div>
            <script>
              // Redirect to app with error
              (function() {
                try {
                  // Immediate redirect
                  window.location.replace('skillswaptn://google/callback?success=false&error=${encodeURIComponent(error.message || 'Unknown error')}');
                  
                  // Fallback
                  setTimeout(function() {
                    window.location.href = 'skillswaptn://google/callback?success=false&error=${encodeURIComponent(error.message || 'Unknown error')}';
                  }, 100);
                  
                  // Final fallback
                  setTimeout(function() {
                    try {
                      window.close();
                    } catch(e) {
                      // Ignore
                    }
                  }, 1000);
                } catch(e) {
                  console.error('Redirect error:', e);
                }
              })();
            </script>
          </body>
        </html>
      `);
    }
  }

  // Check connection status
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getConnectionStatus(@CurrentUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = user.userId;
    const connected = await this.googleService.hasGoogleCalendarConnected(userId);
    return {
      message: connected
        ? 'Google Calendar is connected'
        : 'Google Calendar is not connected',
      data: {
        connected,
        message: connected
          ? 'Google Calendar is connected'
          : 'Google Calendar is not connected',
      },
    };
  }

  // Generate Meet link preview (without creating session)
  @Post('generate-meet-link')
  @UseGuards(JwtAuthGuard)
  async generateMeetLink(
    @CurrentUser() user: any,
    @Body() body: {
      title: string;
      description?: string;
      startTime: string; // ISO string
      endTime: string; // ISO string
      attendees?: string[];
    },
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const userId = user.userId;
      
      // Validate input
      if (!body.title || !body.startTime || !body.endTime) {
        return {
          message: 'Invalid request',
          error: 'Title, startTime, and endTime are required',
          data: null,
        };
      }
      
      const startTime = new Date(body.startTime);
      const endTime = new Date(body.endTime);
      
      // Validate dates
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return {
          message: 'Invalid date format',
          error: 'startTime and endTime must be valid ISO date strings',
          data: null,
        };
      }
      
      if (endTime <= startTime) {
        return {
          message: 'Invalid time range',
          error: 'endTime must be after startTime',
          data: null,
        };
      }
      
      const result = await this.googleService.generateMeetLinkPreview(
        userId,
        body.title,
        body.description || '',
        startTime,
        endTime,
        body.attendees || [],
      );

      return {
        message: 'Meet link generated successfully',
        data: {
          meetLink: result.meetLink,
        },
      };
    } catch (error: any) {
      console.error('Error generating Meet link:', error);
      
      // If it's a BadRequestException, return the error message
      if (error.response?.statusCode === 400 || error.status === 400) {
        return {
          message: error.message || 'Failed to generate Meet link',
          error: error.message || 'An error occurred while generating the Meet link',
          data: null,
        };
      }
      
      // For other errors, return generic message
      return {
        message: 'Failed to generate Meet link',
        error: error.message || 'An error occurred while generating the Meet link',
        data: null,
      };
    }
  }
}
