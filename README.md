# saas-maker

Collection of utilities for building SaaS applications.

## Installation

```bash
npm install saas-maker
# or
yarn add saas-maker
# or
pnpm add saas-maker
```

## Features

- Error handling utilities
- Request validation helpers
- Response formatters
- TypeScript support

## Usage

```typescript
import { throwOnNull, throwIfFalsy, tryCatch } from 'saas-maker';

// Example usage
const processUser = (userId: string | null) => {
  // Will throw if userId is null
  throwOnNull(userId, 'User ID is required');
  
  // Rest of your code
};

// Try-catch wrapper
const result = tryCatch(() => {
  // Your code that might throw
  return 'success';
});

// result will be { success: true, data: 'success' } or { success: false, error: Error }
```

## Notes

Error handling:
- Add global error handling in your server handler and client side. Check for error which is instance of `AppError` (or use `getErrorInfo`)

## License

MIT
