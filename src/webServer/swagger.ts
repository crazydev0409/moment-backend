import { Express as _Express } from 'express';
import { SwaggerOptions as _SwaggerOptions } from 'swagger-ui-express';
import { OpenAPIV3 } from 'openapi-types';

// Type helper for OpenAPI schema
type Schema = OpenAPIV3.SchemaObject;

// Define schema for User
const userSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    phoneNumber: { type: 'string' },
    verified: { type: 'boolean' },
    name: { type: 'string', nullable: true },
    avatar: { type: 'string', nullable: true },
    timezone: { type: 'string', default: 'UTC' },
    bio: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'phoneNumber', 'verified']
};

// Define schema for Moment
const momentSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    userId: { type: 'string', format: 'uuid' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    availability: { type: 'string', enum: ['public', 'private'] },
    notes: { type: 'string', nullable: true },
    icon: { type: 'string', nullable: true },
    allDay: { type: 'boolean', default: false },
    visibleTo: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description: 'User IDs that can see detailed information about this moment'
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'userId', 'startTime', 'endTime', 'availability']
};

// Define schema for RefreshToken
const refreshTokenSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    token: { type: 'string' },
    userId: { type: 'string', format: 'uuid' },
    expiresAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'token', 'userId', 'expiresAt']
};


// Define schema for Contact
const contactSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ownerId: { type: 'string', format: 'uuid' },
    contactUserId: { type: 'string', format: 'uuid', nullable: true },
    contactPhone: { type: 'string' },
    displayName: { type: 'string' },
    phoneBookId: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    importedAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    contactUser: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true }
      }
    }
  },
  required: ['id', 'ownerId', 'contactPhone', 'displayName']
};


// Define schema for BlockedContact
const blockedContactSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    blockerId: { type: 'string', format: 'uuid' },
    blockedId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
    blocked: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true },
        phoneNumber: { type: 'string' }
      }
    }
  },
  required: ['id', 'blockerId', 'blockedId']
};

// Define schema for MomentRequest
const momentRequestSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    senderId: { type: 'string', format: 'uuid' },
    receiverId: { type: 'string', format: 'uuid' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    notes: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'rescheduled'] },
    momentId: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    sender: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', nullable: true },
        phoneNumber: { type: 'string' },
        avatar: { type: 'string', nullable: true }
      }
    },
    receiver: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', nullable: true },
        phoneNumber: { type: 'string' },
        avatar: { type: 'string', nullable: true }
      }
    }
  },
  required: ['id', 'senderId', 'receiverId', 'startTime', 'endTime', 'status']
};

// Swagger document
export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Moment API',
    version: '1.0.0',
    description: 'API for managing user authentication, calendars, and moments'
  },
  servers: [
    {
      url: '/api',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: userSchema,
      Moment: momentSchema,
      RefreshToken: refreshTokenSchema,
      Contact: contactSchema,
      BlockedContact: blockedContactSchema,
      MomentRequest: momentRequestSchema
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phoneNumber'],
                properties: {
                  phoneNumber: {
                    type: 'string',
                    description: 'Phone number in E.164 format (e.g., +1234567890)'
                  }
                }
              },
              example: {
                phoneNumber: '+1234567890'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Verification code sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Verification code sent successfully'
                    },
                    status: {
                      type: 'string',
                      example: 'pending'
                    },
                    expiresIn: {
                      type: 'string',
                      example: '10 minutes'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/verify': {
      post: {
        summary: 'Verify a phone number with a code',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phoneNumber', 'code'],
                properties: {
                  phoneNumber: {
                    type: 'string',
                    description: 'Phone number in E.164 format'
                  },
                  code: {
                    type: 'string',
                    description: 'Verification code sent to the phone'
                  }
                }
              },
              example: {
                phoneNumber: '+1234567890',
                code: '123456'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Verification successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Verification successful'
                    },
                    accessToken: {
                      type: 'string'
                    },
                    refreshToken: {
                      type: 'string'
                    },
                    expiresIn: {
                      type: 'string',
                      example: '1 hour'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: {
                      type: 'string'
                    },
                    expiresIn: {
                      type: 'string',
                      example: '1 hour'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/logout': {
      post: {
        summary: 'Logout user',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Logged out successfully'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/moments': {
      get: {
        summary: 'List all moments for the authenticated user',
        tags: ['Moments'],
        responses: {
          '200': {
            description: 'List of moments',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    moments: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Moment'
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Unauthorized'
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create a new moment',
        tags: ['Moments'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['startTime', 'endTime', 'availability'],
                properties: {
                  startTime: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Start time of the moment'
                  },
                  endTime: {
                    type: 'string',
                    format: 'date-time',
                    description: 'End time of the moment'
                  },
                  availability: {
                    type: 'string',
                    enum: ['public', 'private'],
                    description: 'Availability of the moment'
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional note or description for the moment',
                    nullable: true
                  },
                  icon: {
                    type: 'string',
                    description: 'Optional icon for the moment',
                    nullable: true
                  },
                  allDay: {
                    type: 'boolean',
                    description: 'Whether the moment is an all-day event',
                    default: false
                  },
                  visibleTo: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'uuid'
                    },
                    description: 'Array of user IDs who can see detailed information about this moment'
                  }
                }
              },
              example: {
                startTime: '2023-01-01T10:00:00Z',
                endTime: '2023-01-01T11:00:00Z',
                availability: 'public',
                notes: 'Team meeting',
                icon: 'meeting',
                allDay: false,
                visibleTo: []
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Moment created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Moment created successfully'
                    },
                    moment: {
                      $ref: '#/components/schemas/Moment'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/moments/{id}': {
      put: {
        summary: 'Update a specific moment',
        tags: ['Moments'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID of the moment to update',
            schema: {
              type: 'integer'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  startTime: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Start time of the moment'
                  },
                  endTime: {
                    type: 'string',
                    format: 'date-time',
                    description: 'End time of the moment'
                  },
                  availability: {
                    type: 'string',
                    enum: ['public', 'private'],
                    description: 'Availability of the moment'
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional note or description for the moment',
                    nullable: true
                  },
                  icon: {
                    type: 'string',
                    description: 'Optional icon for the moment',
                    nullable: true
                  },
                  allDay: {
                    type: 'boolean',
                    description: 'Whether the moment is an all-day event',
                    default: false
                  }
                }
              },
              example: {
                startTime: '2023-01-01T10:00:00Z',
                endTime: '2023-01-01T11:00:00Z',
                availability: 'public',
                notes: 'Team meeting',
                icon: 'meeting',
                allDay: false
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Moment updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Moment updated successfully'
                    },
                    moment: {
                      $ref: '#/components/schemas/Moment'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Valid moment ID is required'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Unauthorized'
                    }
                  }
                }
              }
            }
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'You do not have permission to update this moment'
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Moment not found'
                    }
                  }
                }
              }
            }
          }
        }
      },
      delete: {
        summary: 'Delete a specific moment',
        tags: ['Moments'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID of the moment to delete',
            schema: {
              type: 'integer'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Moment deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Moment deleted successfully'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Valid moment ID is required'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Unauthorized'
                    }
                  }
                }
              }
            }
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'You do not have permission to delete this moment'
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Moment not found'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/moments/{id}/share': {
      post: {
        summary: 'Share a moment with specific contacts',
        tags: ['Moments'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID of the moment to share',
            schema: {
              type: 'integer'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['contactIds'],
                properties: {
                  contactIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                    description: 'Array of contact user IDs to share with'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Moment shared successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Moment shared successfully'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Valid moment ID is required'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        summary: 'Health check endpoint',
        tags: ['System'],
        security: [],
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok'
                    },
                    service: {
                      type: 'string',
                      example: 'moment-api'
                    },
                    dependencies: {
                      type: 'object'
                    },
                    details: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/profile': {
      get: {
        summary: 'Get current user profile',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'User profile',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User'
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Unauthorized'
                    }
                  }
                }
              }
            }
          }
        }
      },
      put: {
        summary: 'Update user profile',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    nullable: true,
                    description: "User's display name"
                  },
                  avatar: {
                    type: 'string',
                    nullable: true,
                    description: "URL to user's avatar/profile picture"
                  },
                  timezone: {
                    type: 'string',
                    description: "User's timezone (IANA timezone string)"
                  },
                  bio: {
                    type: 'string',
                    nullable: true,
                    description: 'Short user bio/description'
                  }
                }
              },
              example: {
                name: 'John Doe',
                avatar: 'https://example.com/avatar.jpg',
                timezone: 'America/New_York',
                bio: 'Software developer from New York'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Profile updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Profile updated successfully'
                    },
                    user: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Invalid timezone'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/account': {
      delete: {
        summary: 'Delete user account',
        description: 'Permanently delete the authenticated user\'s account and all associated data. This action cannot be undone.',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'Account deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Account deleted successfully'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Unauthorized'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Failed to delete account'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/notifications': {
      get: {
        summary: 'Get user notifications',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'List of user notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notifications: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string'
                          },
                          type: {
                            type: 'string',
                            enum: ['moment_request', 'moment_approved']
                          },
                          message: {
                            type: 'string'
                          },
                          isRead: {
                            type: 'boolean'
                          },
                          createdAt: {
                            type: 'string',
                            format: 'date-time'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/notifications/read': {
      post: {
        summary: 'Mark specific notifications as read',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['notificationIds'],
                properties: {
                  notificationIds: {
                    type: 'array',
                    items: {
                      type: 'string'
                    },
                    description: 'Array of notification IDs to mark as read'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Notifications marked as read successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Notifications marked as read successfully'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/notifications/read-all': {
      post: {
        summary: 'Mark all notifications as read',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'All notifications marked as read successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'All notifications marked as read successfully'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/notifications/test': {
      post: {
        summary: 'Send test notification (development only)',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: {
                    type: 'string',
                    description: 'Test notification message'
                  },
                  type: {
                    type: 'string',
                    description: 'Notification type'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Test notification sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Test notification sent successfully'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/contacts/registered': {
      get: {
        summary: 'Get contacts that are registered users',
        tags: ['Contacts'],
        responses: {
          '200': {
            description: 'List of registered contacts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    contacts: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Contact'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/moment-requests/multiple': {
      post: {
        summary: 'Create moment requests for multiple recipients',
        tags: ['Moment Requests'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['receiverIds', 'startTime', 'endTime'],
                properties: {
                  receiverIds: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'uuid'
                    },
                    description: 'Array of user IDs to send requests to'
                  },
                  startTime: {
                    type: 'string',
                    format: 'date-time'
                  },
                  endTime: {
                    type: 'string',
                    format: 'date-time'
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional notes for the requests'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Moment requests created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Moment requests created successfully'
                    },
                    result: {
                      type: 'object',
                      properties: {
                        successful: {
                          type: 'integer'
                        },
                        failed: {
                          type: 'integer'
                        },
                        failedReceiverIds: {
                          type: 'array',
                          items: {
                            type: 'string'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/moment-requests': {
      post: {
        summary: 'Create a moment request',
        tags: ['Moment Requests'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['receiverId', 'startTime', 'endTime'],
                properties: {
                  receiverId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'ID of the user to send request to'
                  },
                  startTime: {
                    type: 'string',
                    format: 'date-time'
                  },
                  endTime: {
                    type: 'string',
                    format: 'date-time'
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional notes for the request'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Moment request created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Moment request sent successfully'
                    },
                    request: {
                      $ref: '#/components/schemas/MomentRequest'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/moment-requests/received': {
      get: {
        summary: 'Get received moment requests',
        tags: ['Moment Requests'],
        responses: {
          '200': {
            description: 'List of received moment requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/MomentRequest'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/moment-requests/sent': {
      get: {
        summary: 'Get sent moment requests',
        tags: ['Moment Requests'],
        responses: {
          '200': {
            description: 'List of sent moment requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/MomentRequest'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/moment-requests/{requestId}/respond': {
      post: {
        summary: 'Respond to a moment request',
        tags: ['Moment Requests'],
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            description: 'ID of the moment request',
            schema: {
              type: 'string'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['approved'],
                properties: {
                  approved: {
                    type: 'boolean',
                    description: 'Whether to approve or reject the request'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Response recorded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Request approved successfully'
                    },
                    request: {
                      $ref: '#/components/schemas/MomentRequest'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/moment-requests/{requestId}/reschedule': {
      post: {
        summary: 'Reschedule a moment request',
        tags: ['Moment Requests'],
        parameters: [
          {
            name: 'requestId',
            in: 'path',
            required: true,
            description: 'ID of the moment request',
            schema: {
              type: 'string'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['startTime', 'endTime'],
                properties: {
                  startTime: {
                    type: 'string',
                    format: 'date-time'
                  },
                  endTime: {
                    type: 'string',
                    format: 'date-time'
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional updated notes'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Request rescheduled successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Request rescheduled successfully'
                    },
                    request: {
                      $ref: '#/components/schemas/MomentRequest'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/contacts': {
      get: {
        summary: 'Get all contacts for the authenticated user',
        tags: ['Contacts'],
        responses: {
          '200': {
            description: 'List of contacts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    contacts: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Contact'
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Unauthorized'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/contacts/import': {
      post: {
        summary: 'Import contacts from phone address book',
        tags: ['Contacts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['contacts'],
                properties: {
                  contacts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['phoneNumber', 'displayName'],
                      properties: {
                        phoneNumber: {
                          type: 'string',
                          description: 'Phone number in E.164 format (e.g., +1234567890)'
                        },
                        displayName: {
                          type: 'string',
                          description: "Display name from the phone's address book"
                        },
                        phoneBookId: {
                          type: 'string',
                          description: "Unique identifier from the phone's contact system",
                          nullable: true
                        }
                      }
                    }
                  }
                }
              },
              example: {
                contacts: [
                  {
                    phoneNumber: '+12345678901',
                    displayName: 'John Doe',
                    phoneBookId: 'phone-contact-id-1'
                  },
                  {
                    phoneNumber: '+19876543210',
                    displayName: 'Jane Smith',
                    phoneBookId: 'phone-contact-id-2'
                  }
                ]
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Contacts imported successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Contacts imported successfully'
                    },
                    imported: {
                      type: 'integer',
                      example: 1
                    },
                    updated: {
                      type: 'integer',
                      example: 1
                    },
                    failed: {
                      type: 'integer',
                      example: 0
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Valid contacts array is required'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/contacts/sync': {
      post: {
        summary: 'Sync contacts with registered users',
        tags: ['Contacts'],
        responses: {
          '200': {
            description: 'Contacts synced successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Contacts synced successfully'
                    },
                    updatedCount: {
                      type: 'integer',
                      example: 2
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/blocked': {
      get: {
        summary: 'Get list of blocked users',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'List of blocked users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    blockedUsers: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/BlockedContact'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/block': {
      post: {
        summary: 'Block a user from viewing your calendar',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId'],
                properties: {
                  userId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'ID of the user to block'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'User blocked successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'User blocked successfully'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'User ID is required'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/users/unblock/{userId}': {
      delete: {
        summary: 'Unblock a user',
        tags: ['Users'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'ID of the user to unblock',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'User unblocked successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'User unblocked successfully'
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Block relationship not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Block relationship not found'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/moments/user/{userId}': {
      get: {
        summary: 'Get calendar for another user with respect to visibility permissions',
        tags: ['Moments'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'ID of the user whose calendar to view',
            schema: {
              type: 'string',
              format: 'uuid'
            }
          }
        ],
        responses: {
          '200': {
            description: 'User calendar with moments filtered by visibility settings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: {
                      type: 'string',
                      format: 'uuid'
                    },
                    username: {
                      type: 'string'
                    },
                    moments: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Moment'
                      }
                    }
                  }
                }
              }
            }
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: "You do not have permission to view this user's calendar"
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'User not found'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
  }
};
