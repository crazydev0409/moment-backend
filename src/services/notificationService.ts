import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { http } from '~/helpers/http';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register notification categories for interactive notifications
export async function registerNotificationCategories() {
  // Category for moment requests (Accept/Reject)
  await Notifications.setNotificationCategoryAsync('MOMENT_REQUEST', [
    {
      identifier: 'accept',
      buttonTitle: 'Accept',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: 'reject',
      buttonTitle: 'Reject',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);

  // Category for OTP verification success (Close/Next)
  await Notifications.setNotificationCategoryAsync('OTP_VERIFIED', [
    {
      identifier: 'close',
      buttonTitle: 'Close',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'next',
      buttonTitle: 'Next',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
}

// Request notification permissions (call this on app initialization)
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Check if running in Expo Go (limited push notification support)
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.warn('⚠️ Running in Expo Go: Push notifications have limited support.');
      console.warn('   For full push notification support, use a development build.');
      console.warn('   Local notifications will still work for testing.');
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permission not granted');
      return false;
    }
    
    console.log('✅ Notification permission granted');
    
    // Register categories after permission is granted
    await registerNotificationCategories();
    console.log('📱 Notification categories registered');
    
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Request notification permissions and get push token
// Note: This should be called after user authentication
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  try {
    // Check if permission is already granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Notification permission not granted. Please request permission first.');
      return null;
    }

    // Get the Expo push token
    // Get projectId from Constants or app config
    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId || 
                      (Constants.expoConfig as any)?.projectId ||
                      (Constants.manifest as any)?.extra?.eas?.projectId ||
                      (Constants.manifest2 as any)?.extra?.eas?.projectId;
    
    // Expo SDK 52 requires projectId for push tokens
    if (!projectId) {
      // Silently skip push notifications if projectId is not available
      // This prevents error spam in development
      console.log('ℹ️ Push notifications disabled: projectId not configured');
      console.log('   To enable: Run "eas init" or add projectId to app.json');
      return null;
    }
    
    // Get push token with projectId
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (error: any) {
      // Only log error if it's not about projectId (already handled above)
      if (!error.message?.includes('projectId')) {
        console.error('Failed to get push token:', error.message);
      }
      return null;
    }

    // Categories should already be registered from permission request

    // Register device with backend
    if (token) {
      try {
        // Generate a unique device ID
        const deviceId = `${Platform.OS}-${Date.now()}`;
        // Get app version from Constants or use default
        const appVersion = Constants.expoConfig?.version || '1.0.0';
        const expoVersion = Constants.expoVersion || '52.0.0';
        
        console.log('📤 Registering device with backend...', {
          platform: Platform.OS,
          deviceId,
          appVersion,
          expoVersion,
        });
        
        await http.post('/devices/register', {
          expoPushToken: token,
          platform: Platform.OS,
          deviceId: deviceId,
          appVersion: appVersion,
          expoVersion: expoVersion,
        });
        console.log('✅ Device registered successfully with backend');
        console.log('📲 Push token:', token.substring(0, 20) + '...');
      } catch (error: any) {
        console.error('❌ Failed to register device:', error.response?.data || error.message);
      }
    }
  } catch (error) {
    console.error('Error registering for push notifications:', error);
  }

  return token;
}

// Handle notification responses (when user taps accept/reject or close/next)
export function setupNotificationResponseHandler(
  onAccept: (requestId: string) => void,
  onReject: (requestId: string) => void
) {
  Notifications.addNotificationResponseReceivedListener((response) => {
    const { notification } = response;
    const data = notification.request.content.data as any;
    const actionIdentifier = response.actionIdentifier;

    // Handle moment request notifications
    if (data.eventType === 'moment.request.created') {
      const requestId = data.momentRequestId;

      if (actionIdentifier === 'accept') {
        handleAcceptRequest(requestId, onAccept);
      } else if (actionIdentifier === 'reject') {
        handleRejectRequest(requestId, onReject);
      } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // User tapped the notification itself (not a button)
        console.log('Moment request notification tapped:', requestId);
      }
    }
    
    // Handle OTP verification notifications
    if (data.type === 'otp_verified') {
      if (actionIdentifier === 'close') {
        console.log('OTP verification notification closed');
        // Notification is dismissed
      } else if (actionIdentifier === 'next') {
        console.log('OTP verification notification - Next button pressed');
        // User wants to proceed - navigation is handled by the app flow
      } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        console.log('OTP verification notification tapped');
        // User tapped the notification itself
      }
    }
  });
}

// Handle accept action
async function handleAcceptRequest(requestId: string, onAccept: (requestId: string) => void) {
  try {
    await http.post(`/users/moment-requests/${requestId}/respond`, {
      approved: true,
    });
    console.log('Moment request accepted:', requestId);
    onAccept(requestId);
  } catch (error: any) {
    console.error('Error accepting moment request:', error);
    alert(error.response?.data?.error || 'Failed to accept request');
  }
}

// Handle reject action
async function handleRejectRequest(requestId: string, onReject: (requestId: string) => void) {
  try {
    await http.post(`/users/moment-requests/${requestId}/respond`, {
      approved: false,
    });
    console.log('Moment request rejected:', requestId);
    onReject(requestId);
  } catch (error: any) {
    console.error('Error rejecting moment request:', error);
    alert(error.response?.data?.error || 'Failed to reject request');
  }
}

// Setup notification received handler (when app is in foreground)
export function setupNotificationReceivedHandler(
  onNotificationReceived: (notification: Notifications.Notification) => void
) {
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received in foreground:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });
    onNotificationReceived(notification);
  });
}

// Fetch and display pending moment requests as notifications
export async function showPendingMomentRequestNotifications() {
  try {
    // Check if permission is granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Cannot show notifications: permission not granted');
      return;
    }

    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId || 
                      (Constants.expoConfig as any)?.projectId ||
                      (Constants.manifest as any)?.extra?.eas?.projectId ||
                      (Constants.manifest2 as any)?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.log('Cannot show notifications: projectId not found');
      return;
    }

    // Fetch pending moment requests from backend
    const response = await http.get('/users/moment-requests/pending');
    const requests = response.data.requests || [];

    if (requests.length === 0) {
      console.log('No pending moment requests to display');
      return;
    }

    console.log(`📬 Found ${requests.length} pending moment request(s), displaying notifications...`);

    // Display each pending request as a notification
    for (const request of requests) {
      const senderName = request.sender?.name || request.sender?.phoneNumber || 'Someone';
      const title = request.title || request.notes || 'Meeting Request';
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Moment Request',
          body: `${senderName} invited you to "${title}"`,
          data: {
            eventType: 'moment.request.created',
            momentRequestId: request.id,
            senderName: senderName,
            title: title,
            startTime: request.startTime,
            endTime: request.endTime,
            categoryId: 'MOMENT_REQUEST',
            actions: [
              { action: 'accept', title: 'Accept', requestId: request.id },
              { action: 'reject', title: 'Reject', requestId: request.id }
            ]
          },
          sound: true,
          categoryIdentifier: 'MOMENT_REQUEST', // This will show Accept and Reject buttons
        },
        trigger: null, // Show immediately
      });
    }

    console.log(`✅ Displayed ${requests.length} pending moment request notification(s)`);
  } catch (error: any) {
    console.error('Failed to show pending moment request notifications:', error.message);
    // Don't throw - this is a background operation that shouldn't block app initialization
  }
}

// Send OTP verification success notification
export async function sendOTPVerificationNotification() {
  try {
    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId || 
                      (Constants.expoConfig as any)?.projectId ||
                      (Constants.manifest as any)?.extra?.eas?.projectId ||
                      (Constants.manifest2 as any)?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.warn('Cannot send notification: projectId not found');
      return;
    }

    // Check if permission is granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Cannot send notification: permission not granted');
      return;
    }

    // Send notification with OTP_VERIFIED category (has Close/Next buttons)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'OTP verified successfully',
        body: 'Your phone number has been verified successfully.',
        data: { type: 'otp_verified' },
        sound: true,
        categoryIdentifier: 'OTP_VERIFIED', // This will show Close and Next buttons
      },
      trigger: null, // Show immediately
    });
    
    console.log('✅ OTP verification notification sent');
  } catch (error: any) {
    console.error('Failed to send OTP verification notification:', error.message);
  }
}


