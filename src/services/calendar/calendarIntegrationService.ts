import jwt from 'jsonwebtoken';
import { createDAVClient } from 'tsdav';
import prisma from '../../services/prisma';
import {
  appDeepLinkScheme,
  googleOauthClientId,
  googleOauthClientSecret,
  jwtSecret,
  microsoftOauthClientId,
  microsoftOauthClientSecret,
  microsoftOauthTenantId,
} from '../../config/config';
import { decryptJson, encryptJson } from '../../utils/crypto';
import { CalendarProvider } from '../../types/calendar';

type OAuthStatePayload = {
  userId: string;
  provider: Extract<CalendarProvider, 'google' | 'microsoft'>;
  mobileRedirectUri?: string;
};

type ProviderTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
};

type ExternalEventPayload = {
  providerEventId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location: string | null;
  sourceCalendarName: string | null;
  providerUpdatedAt: Date | null;
};

type GoogleProfile = {
  email?: string;
  name?: string;
};

type MicrosoftProfile = {
  userPrincipalName?: string;
  displayName?: string;
};

type IcloudCredentials = {
  appleId: string;
  appSpecificPassword: string;
};

const OAUTH_PROVIDERS: CalendarProvider[] = ['google', 'microsoft', 'icloud'];
const SYNC_LOOKBACK_DAYS = 30;
const SYNC_LOOKAHEAD_DAYS = 180;

function assertProvider(provider: string): CalendarProvider {
  if (!OAUTH_PROVIDERS.includes(provider as CalendarProvider)) {
    throw new Error('Unsupported calendar provider');
  }

  return provider as CalendarProvider;
}

function buildTimeRange() {
  const start = new Date();
  start.setDate(start.getDate() - SYNC_LOOKBACK_DAYS);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setDate(end.getDate() + SYNC_LOOKAHEAD_DAYS);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function cleanIcsValue(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .trim();
}

function unfoldIcsLines(input: string): string[] {
  return input
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/)
    .filter(Boolean);
}

function parseIcsDate(value: string): { date: Date; isAllDay: boolean } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    return {
      date: new Date(Date.UTC(year, month - 1, day)),
      isAllDay: true,
    };
  }

  const normalized = trimmed.endsWith('Z')
    ? trimmed
    : trimmed.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
        '$1-$2-$3T$4:$5:$6',
      );

  if (/^\d{8}T\d{6}Z$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}T${trimmed.slice(9, 11)}:${trimmed.slice(11, 13)}:${trimmed.slice(13, 15)}Z`;
    return {
      date: new Date(iso),
      isAllDay: false,
    };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: parsed,
    isAllDay: false,
  };
}

function parseIcloudCalendarObject(data: string, sourceCalendarName?: string | null): ExternalEventPayload | null {
  const lines = unfoldIcsLines(data);
  const record: Record<string, string> = {};

  for (const line of lines) {
    if (!line.includes(':')) {
      continue;
    }

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.split(';')[0].toUpperCase();
    const value = rest.join(':');

    if (['UID', 'SUMMARY', 'DESCRIPTION', 'LOCATION', 'DTSTART', 'DTEND', 'LAST-MODIFIED'].includes(key)) {
      record[key] = value;
    }
  }

  if (!record.UID || !record.DTSTART || !record.DTEND) {
    return null;
  }

  const start = parseIcsDate(record.DTSTART);
  const end = parseIcsDate(record.DTEND);
  if (!start || !end) {
    return null;
  }

  const lastModified = record['LAST-MODIFIED'] ? parseIcsDate(record['LAST-MODIFIED']) : null;

  return {
    providerEventId: record.UID,
    title: cleanIcsValue(record.SUMMARY || 'Busy'),
    description: record.DESCRIPTION ? cleanIcsValue(record.DESCRIPTION) : null,
    startTime: start.date,
    endTime: end.date,
    isAllDay: start.isAllDay || end.isAllDay,
    location: record.LOCATION ? cleanIcsValue(record.LOCATION) : null,
    sourceCalendarName: sourceCalendarName || null,
    providerUpdatedAt: lastModified?.date || null,
  };
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export class CalendarIntegrationService {
  private getBackendRedirectUri(baseUrl: string, provider: Extract<CalendarProvider, 'google' | 'microsoft'>): string {
    return `${baseUrl}/api/users/calendar-integrations/${provider}/callback`;
  }

  private getMobileRedirectUrl(
    provider: CalendarProvider,
    status: 'success' | 'error',
    errorMessage?: string,
    mobileRedirectUri?: string,
  ): string {
    const params = new URLSearchParams({
      provider,
      status,
    });

    if (errorMessage) {
      params.set('message', errorMessage);
    }

    // Use the mobile redirect URI from the OAuth state if available (e.g. exp:// in dev mode),
    // otherwise fall back to the native deep link scheme (catch://)
    const baseUri = mobileRedirectUri || `${appDeepLinkScheme}://calendar-integration`;
    const separator = baseUri.includes('?') ? '&' : '?';
    return `${baseUri}${separator}${params.toString()}`;
  }

  private buildOAuthState(payload: OAuthStatePayload): string {
    return jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
  }

  private verifyOAuthState(state: string): OAuthStatePayload {
    const decoded = jwt.verify(state, jwtSecret) as OAuthStatePayload;
    return decoded;
  }

  private async persistOAuthIntegration(
    userId: string,
    provider: Extract<CalendarProvider, 'google' | 'microsoft'>,
    tokens: ProviderTokens,
    profile: { accountEmail?: string; accountName?: string },
  ) {
    const existing = await prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    return prisma.calendarIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      update: {
        status: 'connected',
        accountEmail: profile.accountEmail || existing?.accountEmail || null,
        accountName: profile.accountName || existing?.accountName || null,
        encryptedAccessToken: encryptJson({ accessToken: tokens.accessToken }),
        encryptedRefreshToken: encryptJson({
          refreshToken: tokens.refreshToken || this.getStoredRefreshToken(existing?.encryptedRefreshToken),
        }),
        tokenExpiresAt: tokens.expiresAt || null,
        lastSyncError: null,
      },
      create: {
        userId,
        provider,
        status: 'connected',
        accountEmail: profile.accountEmail || null,
        accountName: profile.accountName || null,
        encryptedAccessToken: encryptJson({ accessToken: tokens.accessToken }),
        encryptedRefreshToken: encryptJson({ refreshToken: tokens.refreshToken || null }),
        tokenExpiresAt: tokens.expiresAt || null,
      },
    });
  }

  private getStoredRefreshToken(payload: string | null | undefined): string | null {
    const decrypted = decryptJson<{ refreshToken?: string | null }>(payload);
    return decrypted?.refreshToken || null;
  }

  private async refreshGoogleAccessToken(refreshToken: string): Promise<ProviderTokens> {
    const response = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: googleOauthClientId,
        client_secret: googleOauthClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || refreshToken,
      expiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : null,
    };
  }

  private async refreshMicrosoftAccessToken(refreshToken: string): Promise<ProviderTokens> {
    const response = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(`https://login.microsoftonline.com/${microsoftOauthTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: microsoftOauthClientId,
        client_secret: microsoftOauthClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'offline_access openid profile email User.Read Calendars.Read',
      }),
    });

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || refreshToken,
      expiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : null,
    };
  }

  private async getFreshAccessToken(integration: {
    provider: string;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
    id: string;
  }): Promise<string> {
    const access = decryptJson<{ accessToken?: string }>(integration.encryptedAccessToken);
    const refresh = decryptJson<{ refreshToken?: string | null }>(integration.encryptedRefreshToken);
    const hasValidAccessToken =
      access?.accessToken &&
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt.getTime() > Date.now() + 60_000;

    if (hasValidAccessToken && access?.accessToken) {
      return access.accessToken;
    }

    if (!refresh?.refreshToken) {
      if (access?.accessToken) {
        return access.accessToken;
      }

      throw new Error('Calendar integration requires reconnection');
    }

    const refreshed =
      integration.provider === 'google'
        ? await this.refreshGoogleAccessToken(refresh.refreshToken)
        : await this.refreshMicrosoftAccessToken(refresh.refreshToken);

    await prisma.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        encryptedAccessToken: encryptJson({ accessToken: refreshed.accessToken }),
        encryptedRefreshToken: encryptJson({ refreshToken: refreshed.refreshToken || refresh.refreshToken }),
        tokenExpiresAt: refreshed.expiresAt || null,
      },
    });

    return refreshed.accessToken;
  }

  private async fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    return fetchJson<GoogleProfile>('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  private async fetchMicrosoftProfile(accessToken: string): Promise<MicrosoftProfile> {
    return fetchJson<MicrosoftProfile>('https://graph.microsoft.com/v1.0/me?$select=displayName,userPrincipalName', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  private async fetchGoogleEvents(accessToken: string): Promise<ExternalEventPayload[]> {
    const { start, end } = buildTimeRange();
    const response = await fetchJson<{
      items?: Array<{
        id: string;
        summary?: string;
        description?: string;
        location?: string;
        updated?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    }>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeZone=UTC&timeMin=${encodeURIComponent(
        start.toISOString(),
      )}&timeMax=${encodeURIComponent(end.toISOString())}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const events: ExternalEventPayload[] = [];

    for (const item of response.items || []) {
      const startValue = item.start?.dateTime || item.start?.date;
      const endValue = item.end?.dateTime || item.end?.date;
      if (!item.id || !startValue || !endValue) {
        continue;
      }

      const parsedStart = new Date(startValue);
      const parsedEnd = new Date(endValue);
      console.log(`[fetchGoogleEvents] Event "${item.summary}": raw start="${startValue}" raw end="${endValue}" → parsed start=${parsedStart.toISOString()} end=${parsedEnd.toISOString()}`);

      events.push({
        providerEventId: item.id,
        title: item.summary || 'Busy',
        description: item.description || null,
        startTime: parsedStart,
        endTime: parsedEnd,
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        location: item.location || null,
        sourceCalendarName: 'Google Calendar',
        providerUpdatedAt: item.updated ? new Date(item.updated) : null,
      });
    }

    return events;
  }

  private async fetchMicrosoftEvents(accessToken: string): Promise<ExternalEventPayload[]> {
    const { start, end } = buildTimeRange();
    const response = await fetchJson<{
      value?: Array<{
        id: string;
        subject?: string;
        bodyPreview?: string;
        location?: { displayName?: string };
        lastModifiedDateTime?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      }>;
    }>(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(
        start.toISOString(),
      )}&endDateTime=${encodeURIComponent(end.toISOString())}&$orderby=start/dateTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      },
    );

    const events: ExternalEventPayload[] = [];

    for (const item of response.value || []) {
      if (!item.id || !item.start?.dateTime || !item.end?.dateTime) {
        continue;
      }

      events.push({
        providerEventId: item.id,
        title: item.subject || 'Busy',
        description: item.bodyPreview || null,
        startTime: new Date(item.start.dateTime + 'Z'),
        endTime: new Date(item.end.dateTime + 'Z'),
        isAllDay: false,
        location: item.location?.displayName || null,
        sourceCalendarName: 'Microsoft Calendar',
        providerUpdatedAt: item.lastModifiedDateTime
          ? new Date(item.lastModifiedDateTime)
          : null,
      });
    }

    return events;
  }

  private async fetchIcloudEvents(credentials: IcloudCredentials): Promise<ExternalEventPayload[]> {
    const { start, end } = buildTimeRange();
    const client = await createDAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: credentials.appleId,
        password: credentials.appSpecificPassword,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    const calendars = await client.fetchCalendars();
    const eventCollections = await Promise.all(
      calendars.map(async (calendar) => {
        const objects = await client.fetchCalendarObjects({
          calendar,
          timeRange: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        });

        return objects
          .map((calendarObject) =>
            calendarObject.data
              ? parseIcloudCalendarObject(calendarObject.data, typeof calendar.displayName === 'string' ? calendar.displayName : 'iCloud Calendar')
              : null,
          )
          .filter((event): event is ExternalEventPayload => Boolean(event));
      }),
    );

    return eventCollections.flat();
  }

  private async replaceIntegrationEvents(integrationId: string, events: ExternalEventPayload[]) {
    await prisma.$transaction(async (tx) => {
      await tx.externalCalendarEvent.deleteMany({
        where: {
          integrationId,
        },
      });

      if (events.length > 0) {
        await tx.externalCalendarEvent.createMany({
          data: events.map((event) => ({
            integrationId,
            providerEventId: event.providerEventId,
            title: event.title,
            description: event.description || null,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay || false,
            location: event.location || null,
            sourceCalendarName: event.sourceCalendarName || null,
            providerUpdatedAt: event.providerUpdatedAt || null,
          })),
        });
      }
    });
  }

  private async markSyncResult(
    integrationId: string,
    data: {
      status: 'connected' | 'error';
      error?: string | null;
    },
  ) {
    await prisma.calendarIntegration.update({
      where: { id: integrationId },
      data: {
        status: data.status,
        lastSyncedAt: data.status === 'connected' ? new Date() : undefined,
        lastSyncStatus: data.status,
        lastSyncError: data.error || null,
      },
    });
  }

  async listIntegrations(userId: string) {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });

    return integrations.map((integration) => ({
      provider: integration.provider,
      status: integration.status,
      accountEmail: integration.accountEmail,
      accountName: integration.accountName,
      lastSyncedAt: integration.lastSyncedAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      connected: integration.status === 'connected',
    }));
  }

  async getAuthorizationUrl(
    userId: string,
    providerInput: string,
    baseUrl: string,
    mobileRedirectUri?: string,
  ) {
    const provider = assertProvider(providerInput);
    if (provider === 'icloud') {
      throw new Error('iCloud uses app-specific credentials instead of OAuth');
    }

    if (provider === 'google' && (!googleOauthClientId || !googleOauthClientSecret)) {
      throw new Error('Google OAuth credentials are not configured');
    }

    if (provider === 'microsoft' && (!microsoftOauthClientId || !microsoftOauthClientSecret)) {
      throw new Error('Microsoft OAuth credentials are not configured');
    }

    const state = this.buildOAuthState({
      userId,
      provider,
      mobileRedirectUri,
    });
    const redirectUri = this.getBackendRedirectUri(baseUrl, provider);

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: googleOauthClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        scope: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ].join(' '),
        state,
      });

      return {
        provider,
        authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      };
    }

    console.log(`[Microsoft OAuth] client_id="${microsoftOauthClientId}" tenant="${microsoftOauthTenantId}" redirect_uri="${redirectUri}"`);

    const params = new URLSearchParams({
      client_id: microsoftOauthClientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'offline_access openid profile email User.Read Calendars.Read',
      prompt: 'select_account',
      state,
    });

    const authorizationUrl = `https://login.microsoftonline.com/${microsoftOauthTenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    console.log(`[Microsoft OAuth] Full authorization URL: ${authorizationUrl}`);

    return {
      provider,
      authorizationUrl,
    };
  }

  async handleOAuthCallback(
    providerInput: string,
    code: string,
    state: string,
    baseUrl: string,
  ) {
    const provider = assertProvider(providerInput);
    if (provider === 'icloud') {
      throw new Error('Unsupported callback provider');
    }

    const payload = this.verifyOAuthState(state);
    if (payload.provider !== provider) {
      throw new Error('OAuth state provider mismatch');
    }

    const redirectUri = this.getBackendRedirectUri(baseUrl, provider);

    if (provider === 'google') {
      const tokens = await fetchJson<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      }>('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: googleOauthClientId,
          client_secret: googleOauthClientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const profile = await this.fetchGoogleProfile(tokens.access_token);
      await this.persistOAuthIntegration(payload.userId, provider, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      }, {
        accountEmail: profile.email,
        accountName: profile.name,
      });

      await this.syncIntegration(payload.userId, provider);
      return this.getMobileRedirectUrl(provider, 'success', undefined, payload.mobileRedirectUri);
    }

    const tokens = await fetchJson<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>(`https://login.microsoftonline.com/${microsoftOauthTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: microsoftOauthClientId,
        client_secret: microsoftOauthClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'offline_access openid profile email User.Read Calendars.Read',
      }),
    });

    const profile = await this.fetchMicrosoftProfile(tokens.access_token);
    await this.persistOAuthIntegration(payload.userId, provider, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    }, {
      accountEmail: profile.userPrincipalName,
      accountName: profile.displayName,
    });

    await this.syncIntegration(payload.userId, provider);
    return this.getMobileRedirectUrl(provider, 'success', undefined, payload.mobileRedirectUri);
  }

  async connectIcloud(
    userId: string,
    appleId: string,
    appSpecificPassword: string,
  ) {
    const events = await this.fetchIcloudEvents({
      appleId,
      appSpecificPassword,
    });

    const integration = await prisma.calendarIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'icloud',
        },
      },
      update: {
        status: 'connected',
        accountEmail: appleId,
        accountName: appleId,
        encryptedCredentials: encryptJson({
          appleId,
          appSpecificPassword,
        }),
        lastSyncError: null,
      },
      create: {
        userId,
        provider: 'icloud',
        status: 'connected',
        accountEmail: appleId,
        accountName: appleId,
        encryptedCredentials: encryptJson({
          appleId,
          appSpecificPassword,
        }),
      },
    });

    await this.replaceIntegrationEvents(integration.id, events);
    await this.markSyncResult(integration.id, { status: 'connected' });

    return {
      provider: integration.provider,
      accountEmail: integration.accountEmail,
      connected: true,
      lastSyncedAt: new Date(),
    };
  }

  async syncIntegration(userId: string, providerInput: string) {
    const provider = assertProvider(providerInput);
    const integration = await prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!integration) {
      throw new Error('Calendar integration not found');
    }

    try {
      let events: ExternalEventPayload[] = [];

      if (provider === 'google') {
        const accessToken = await this.getFreshAccessToken(integration);
        events = await this.fetchGoogleEvents(accessToken);
      } else if (provider === 'microsoft') {
        const accessToken = await this.getFreshAccessToken(integration);
        events = await this.fetchMicrosoftEvents(accessToken);
      } else {
        const credentials = decryptJson<IcloudCredentials>(integration.encryptedCredentials);
        if (!credentials?.appleId || !credentials?.appSpecificPassword) {
          throw new Error('Stored iCloud credentials are incomplete');
        }
        events = await this.fetchIcloudEvents(credentials);
      }

      await this.replaceIntegrationEvents(integration.id, events);
      await this.markSyncResult(integration.id, { status: 'connected' });

      return {
        provider,
        syncedEvents: events.length,
        lastSyncedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calendar sync failed';
      await this.markSyncResult(integration.id, {
        status: 'error',
        error: message,
      });
      throw error;
    }
  }

  async disconnectIntegration(userId: string, providerInput: string) {
    const provider = assertProvider(providerInput);
    const integration = await prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!integration) {
      return;
    }

    await prisma.calendarIntegration.delete({
      where: { id: integration.id },
    });
  }
}
