type ErrorContext = 'window.error' | 'unhandledrejection' | 'react' | 'query' | 'mutation';

type ClientErrorPayload = {
  type: 'client_error';
  context: ErrorContext;
  errorCode: string;
  route: string;
  online: boolean;
  occurredAt: string;
};

const errorEndpoint = import.meta.env.VITE_ERROR_REPORTING_ENDPOINT as string | undefined;
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const safeRoute = () => typeof window === 'undefined' ? '' : window.location.pathname.replace(uuidPattern, ':id');

export function getClientErrorCode(error: unknown) {
  if (error instanceof Error && error.name.trim()) return error.name.trim().slice(0, 80);
  if (error instanceof DOMException && error.code) return `DOMException_${error.code}`;
  return 'UnknownError';
}

export function reportClientError(error: unknown, context: ErrorContext) {
  if (!errorEndpoint || typeof navigator === 'undefined') return;
  const payload: ClientErrorPayload = {
    type: 'client_error',
    context,
    errorCode: getClientErrorCode(error),
    route: safeRoute(),
    online: navigator.onLine,
    occurredAt: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(errorEndpoint, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(errorEndpoint, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Error reporting must never affect the user flow.
  }
}

export function installClientErrorTracking() {
  if (typeof window === 'undefined') return () => undefined;
  const handleError = (event: ErrorEvent) => reportClientError(event.error || new Error(event.message), 'window.error');
  const handleRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason, 'unhandledrejection');
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
