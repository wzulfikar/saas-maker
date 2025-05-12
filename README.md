# maker-utils

Collection of utilities for building SaaS applications.

## Installation

```bash
npm install maker-utils
# or
yarn add maker-utils
# or
pnpm add maker-utils
```

## Features

- Error handling utilities
- Request validation helpers
- Response formatters
- TypeScript support

## Usage

```typescript
import { throwOnNull, throwIfFalsy, tryCatch } from 'maker-utils';

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

## License

MIT
