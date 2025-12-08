import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class GoogleService {
  private oauth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  // Generate OAuth authorization URL
  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      state: userId, // Pass userId in state for callback
    });
  }

  // Handle OAuth callback and store refresh token
  async handleCallback(code: string, userId: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        throw new BadRequestException('No refresh token received. Please re-authorize.');
      }

      // Store refresh token in user document
      await this.userModel.findByIdAndUpdate(userId, {
        googleRefreshToken: tokens.refresh_token,
      });
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      throw new BadRequestException('Failed to authenticate with Google');
    }
  }

  // Get authenticated calendar client for a user
  private async getCalendarClient(userId: string) {
    const user = await this.userModel.findById(userId);
    
    if (!user?.googleRefreshToken) {
      throw new BadRequestException(
        'User has not connected Google Calendar. Please connect your Google account first.',
      );
    }

    this.oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
    });

    // Refresh access token if needed
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Update the stored tokens if we got new ones
      if (credentials.access_token) {
        this.oauth2Client.setCredentials(credentials);
        console.log('Google access token refreshed successfully');
      }
    } catch (error: any) {
      console.error('Error refreshing Google access token:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });
      
      // Check if it's a token expiration error
      const errorMessage = error.message || '';
      const errorCode = error.code || '';
      
      if (
        errorCode === 400 ||
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired') ||
        errorMessage.includes('invalid_request') ||
        error.response?.data?.error === 'invalid_grant'
      ) {
        // Refresh token is invalid or expired - user needs to reconnect
        // Clear the invalid refresh token from database
        await this.userModel.findByIdAndUpdate(userId, {
          $unset: { googleRefreshToken: 1 },
        });
        
        throw new BadRequestException(
          'Google Calendar connection expired. Please reconnect your Google account.',
        );
      } else {
        // For other errors, try to continue - sometimes the token is still valid
        console.warn('Token refresh failed but continuing with existing credentials:', error.message);
        // Don't throw - try to use existing credentials
      }
    }

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  // Create Google Calendar event with Meet link
  async createEventForSession(
    userId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = [],
  ): Promise<{ eventId: string; meetLink: string }> {
    const calendar = await this.getCalendarClient(userId);

    const event = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1, // Required for Meet links
      });

      const eventId = response.data.id || '';
      const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri || '';

      if (!meetLink) {
        throw new BadRequestException('Failed to create Google Meet link');
      }

      return { eventId, meetLink };
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw new BadRequestException('Failed to create Google Calendar event');
    }
  }

  // Update Google Calendar event (for reschedule)
  async updateEventForSession(
    userId: string,
    eventId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = [],
  ): Promise<{ eventId: string; meetLink: string }> {
    const calendar = await this.getCalendarClient(userId);

    try {
      // First, get the existing event to preserve Meet link
      const existingEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      const event = {
        summary: title,
        description: description || '',
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: attendees.map((email) => ({ email })),
        // Preserve existing conference data or create new if missing
        conferenceData: existingEvent.data.conferenceData || {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all', // Send email notifications to attendees
      });

      const meetLink =
        response.data.conferenceData?.entryPoints?.[0]?.uri ||
        existingEvent.data.conferenceData?.entryPoints?.[0]?.uri ||
        '';

      return { eventId: response.data.id || eventId, meetLink };
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw new BadRequestException('Failed to update Google Calendar event');
    }
  }

  // Delete Google Calendar event
  async deleteEventForSession(userId: string, eventId: string): Promise<void> {
    const calendar = await this.getCalendarClient(userId);

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      // Don't throw - event might not exist or already deleted
    }
  }

  // Check if user has connected Google Calendar
  async hasGoogleCalendarConnected(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    return !!user?.googleRefreshToken;
  }

  // Generate Google Meet link without creating a calendar event (preview only)
  async generateMeetLinkPreview(
    userId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = [],
  ): Promise<{ meetLink: string }> {
    const calendar = await this.getCalendarClient(userId);

    // Create a temporary event to get the Meet link
    // We'll delete it immediately after getting the link
    const event = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    try {
      // Create event to get Meet link
      console.log('Creating temporary Google Calendar event to generate Meet link...');
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1,
      });

      const eventId = response.data.id || '';
      const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri || '';

      console.log('Event created, Meet link:', meetLink ? 'Generated' : 'Not found');

      if (!meetLink) {
        console.error('Meet link not found in response. Response data:', JSON.stringify(response.data, null, 2));
        // Try to delete the event before throwing error
        if (eventId) {
          try {
            await calendar.events.delete({
              calendarId: 'primary',
              eventId: eventId,
            });
          } catch (deleteError) {
            console.warn('Failed to delete event after error:', deleteError);
          }
        }
        throw new BadRequestException(
          'Google Calendar did not return a Meet link. Please ensure your Google account has Meet enabled.',
        );
      }

      // Delete the temporary event in the background (don't wait for it)
      // This speeds up the response time
      if (eventId) {
        // Fire and forget - don't await
        calendar.events
          .delete({
            calendarId: 'primary',
            eventId: eventId,
          })
          .catch((deleteError) => {
            // Log but don't fail - the link is already generated
            console.warn('Failed to delete preview event (background):', deleteError);
          });
      }

      return { meetLink };
    } catch (error: any) {
      console.error('Error generating Google Meet link preview:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('refresh_token')) {
        throw new BadRequestException(
          'Google Calendar connection expired. Please reconnect your Google account.',
        );
      } else if (error.message?.includes('not connected')) {
        throw new BadRequestException(
          'Google Calendar is not connected. Please connect your Google account first.',
        );
      } else if (error.message) {
        throw new BadRequestException(`Failed to generate Meet link: ${error.message}`);
      } else {
        throw new BadRequestException(
          'Failed to generate Google Meet link. Please check your Google Calendar connection and try again.',
        );
      }
    }
  }
}

