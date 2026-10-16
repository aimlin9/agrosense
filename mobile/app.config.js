/**
 * Dynamic Expo config layered on top of app.json.
 *
 * Environment variables (set in mobile/.env, EAS secrets, or the shell):
 *   EXPO_PUBLIC_API_URL                 Backend base URL (defaults to production)
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID    OAuth web client ID (used for the ID token)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    OAuth iOS client ID — enables Google
 *                                       Sign-In on iOS; the URL scheme is derived
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const iosUrlScheme = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
    : 'com.googleusercontent.apps.placeholder';

  const plugins = (config.plugins || []).map((p) =>
    Array.isArray(p) && p[0] === '@react-native-google-signin/google-signin'
      ? [p[0], { ...p[1], iosUrlScheme }]
      : p,
  );

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || config.extra?.googleWebClientId,
      googleIosClientId: iosClientId,
    },
  };
};
