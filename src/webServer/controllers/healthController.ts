import { RequestHandler as _RequestHandler } from 'express';
import { twilioVerifyServiceSid, isDevelopment } from '../../config/config';
import { twilioClient } from '../../services/twilio';
import { bytesToMB } from '../../utils/memory';
import { HealthCheckResponse } from '../../types/health';
import { CustomRequestHandler } from '../../types/express';

/**
 * Health check endpoint to verify system status
 */
export const healthCheck: CustomRequestHandler = async (req, res) => {
  const memUsage = process.memoryUsage();
  const usedMB = bytesToMB(memUsage.heapUsed);
  const totalMB = bytesToMB(memUsage.heapTotal);
  const memoryPercentage = Number(((usedMB / totalMB) * 100).toFixed(1));

  const healthcheck: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'moment-api',
    dependencies: {
      twilio: {
        status: 'unknown',
        error: null
      }
    },
    details: {
      memory: {
        used: {
          value: usedMB,
          unit: 'MB'
        },
        total: {
          value: totalMB,
          unit: 'MB'
        },
        percentage: memoryPercentage
      }
    }
  };

  try {
    // Check Twilio connectivity
    try {
      await twilioClient.verify.v2.services(twilioVerifyServiceSid).fetch();
      healthcheck.dependencies.twilio = {
        status: 'connected',
        error: null
      };
    } catch (twilioError: any) {
      healthcheck.status = 'error';
      healthcheck.dependencies.twilio = {
        status: 'disconnected',
        error: twilioError.message || 'Failed to connect to Twilio'
      };
    }

    // Send response with appropriate status code
    if (healthcheck.status === 'ok') {
      return res.json(healthcheck);
    } else {
      return res.status(503).json(healthcheck);
    }
  } catch (error: any) {
    healthcheck.status = 'error';
    healthcheck.details.error = {
      message: error.message || 'An unexpected error occurred',
      stack: isDevelopment ? error.stack : undefined
    };
    return res.status(503).json(healthcheck);
  }
};
