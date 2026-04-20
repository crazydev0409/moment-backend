import { CustomRequestHandler } from '../../types/express';
import { CalendarIntegrationService } from '../../services/calendar/calendarIntegrationService';
import { UserService } from '../../services/users/userService';

const calendarIntegrationService = new CalendarIntegrationService();
const userService = new UserService();

const buildBaseUrl = (req: Parameters<CustomRequestHandler>[0]) => {
  if (process.env.OAUTH_REDIRECT_BASE_URL) {
    return process.env.OAUTH_REDIRECT_BASE_URL.replace(/\/+$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' ? forwardedProto : req.protocol;
  return `${protocol}://${req.get('host')}`;
};

const parseRange = (query: Record<string, unknown>) => {
  if (typeof query.start === 'string' && typeof query.end === 'string') {
    const start = new Date(query.start);
    const end = new Date(query.end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new Error('Invalid calendar event range');
    }

    return { start, end };
  }

  if (typeof query.date === 'string') {
    const [year, month, day] = query.date.split('-').map(Number);
    if (!year || !month || !day) {
      throw new Error('Invalid calendar event date');
    }

    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
    return { start, end };
  }

  throw new Error('A date or start/end range is required');
};

export const listCalendarIntegrations: CustomRequestHandler = async (req, res) => {
  try {
    const integrations = await calendarIntegrationService.listIntegrations(req.user!.id);
    return res.json({ integrations });
  } catch (error) {
    console.error('Error listing calendar integrations:', error);
    return res.status(500).json({ error: 'Failed to list calendar integrations' });
  }
};

export const startCalendarOAuth: CustomRequestHandler = async (req, res) => {
  try {
    const { provider } = req.params;
    const data = await calendarIntegrationService.getAuthorizationUrl(
      req.user!.id,
      provider,
      buildBaseUrl(req),
    );

    return res.json(data);
  } catch (error) {
    console.error('Error starting calendar OAuth:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to start calendar OAuth',
    });
  }
};

export const handleCalendarOAuthCallback: CustomRequestHandler = async (req, res) => {
  const { provider } = req.params;
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';

  if (providerError) {
    return res.redirect(
      `${process.env.APP_DEEP_LINK_SCHEME || 'catch'}://calendar-integration?provider=${provider}&status=error&message=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code || !state) {
    return res.redirect(
      `${process.env.APP_DEEP_LINK_SCHEME || 'catch'}://calendar-integration?provider=${provider}&status=error&message=${encodeURIComponent(
        'Missing OAuth code or state',
      )}`,
    );
  }

  try {
    const redirectUrl = await calendarIntegrationService.handleOAuthCallback(
      provider,
      code,
      state,
      buildBaseUrl(req),
    );
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error handling calendar OAuth callback:', error);
    return res.redirect(
      `${process.env.APP_DEEP_LINK_SCHEME || 'catch'}://calendar-integration?provider=${provider}&status=error&message=${encodeURIComponent(
        error instanceof Error ? error.message : 'Calendar connection failed',
      )}`,
    );
  }
};

export const connectIcloudIntegration: CustomRequestHandler = async (req, res) => {
  try {
    const { appleId, appSpecificPassword } = req.body;

    if (!appleId || !appSpecificPassword) {
      return res.status(400).json({ error: 'Apple ID and app-specific password are required' });
    }

    const integration = await calendarIntegrationService.connectIcloud(
      req.user!.id,
      appleId,
      appSpecificPassword,
    );

    return res.json({
      message: 'iCloud calendar connected successfully',
      integration,
    });
  } catch (error) {
    console.error('Error connecting iCloud calendar:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to connect iCloud calendar',
    });
  }
};

export const syncCalendarIntegration: CustomRequestHandler = async (req, res) => {
  try {
    const { provider } = req.params;
    const result = await calendarIntegrationService.syncIntegration(req.user!.id, provider);

    return res.json({
      message: 'Calendar synced successfully',
      ...result,
    });
  } catch (error) {
    console.error('Error syncing calendar integration:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to sync calendar',
    });
  }
};

export const disconnectCalendarIntegration: CustomRequestHandler = async (req, res) => {
  try {
    const { provider } = req.params;
    await calendarIntegrationService.disconnectIntegration(req.user!.id, provider);
    return res.json({ message: 'Calendar integration disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting calendar integration:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to disconnect calendar integration',
    });
  }
};

export const getBookableUser: CustomRequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await userService.getBookableUser(req.user!.id, userId);
    return res.json({ user });
  } catch (error) {
    console.error('Error getting bookable user:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to get bookable user',
    });
  }
};

export const getAvailability: CustomRequestHandler = async (req, res) => {
  try {
    const schedule = await userService.getAvailabilitySchedule(req.user!.id);
    return res.json(schedule);
  } catch (error) {
    console.error('Error getting availability schedule:', error);
    return res.status(500).json({ error: 'Failed to get availability schedule' });
  }
};

export const getUserAvailability: CustomRequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (userId !== req.user!.id) {
      const blocked = await userService.isUserBlocked(req.user!.id, userId);
      if (blocked) {
        return res.status(403).json({ error: 'You do not have permission to view this availability' });
      }
    }

    const schedule = await userService.getAvailabilitySchedule(userId);
    return res.json(schedule);
  } catch (error) {
    console.error('Error getting user availability schedule:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to get user availability schedule',
    });
  }
};

export const updateAvailability: CustomRequestHandler = async (req, res) => {
  try {
    const { timezone, slots } = req.body;

    if (!timezone || !Array.isArray(slots)) {
      return res.status(400).json({ error: 'Timezone and slots are required' });
    }

    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch (error) {
      return res.status(400).json({ error: 'Invalid timezone' });
    }

    const schedule = await userService.updateAvailabilitySchedule(req.user!.id, {
      timezone,
      slots,
    });

    return res.json({
      message: 'Availability updated successfully',
      ...schedule,
    });
  } catch (error) {
    console.error('Error updating availability schedule:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update availability schedule',
    });
  }
};

export const getMyCalendarEvents: CustomRequestHandler = async (req, res) => {
  try {
    const { start, end } = parseRange(req.query as Record<string, unknown>);
    console.log(`[getMyCalendarEvents] userId=${req.user!.id} range=${start.toISOString()} to ${end.toISOString()}`);
    const events = await userService.getCalendarEventsForUser(
      req.user!.id,
      req.user!.id,
      start,
      end,
    );
    const internal = events.filter(e => e.sourceType === 'internal').length;
    const external = events.filter(e => e.sourceType === 'external').length;
    console.log(`[getMyCalendarEvents] Returning ${events.length} events (${internal} internal, ${external} external)`);
    if (external > 0) {
      console.log('[getMyCalendarEvents] External events:', events.filter(e => e.sourceType === 'external').map(e => ({ id: e.id, title: e.title, source: e.source, start: e.startTime, end: e.endTime })));
    }
    return res.json({ events });
  } catch (error) {
    console.error('Error getting current user calendar events:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to get calendar events',
    });
  }
};

export const getUserCalendarEvents: CustomRequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { start, end } = parseRange(req.query as Record<string, unknown>);
    const events = await userService.getCalendarEventsForUser(
      userId,
      req.user!.id,
      start,
      end,
    );
    return res.json({ events });
  } catch (error) {
    console.error('Error getting user calendar events:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to get user calendar events',
    });
  }
};
