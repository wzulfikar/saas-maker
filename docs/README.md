# docs

This is a Next.js application generated with
[Create Fumadocs](https://github.com/fuma-nama/fumadocs).

Run development server:

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open http://localhost:3000 with your browser to see the result.

## Explore

In the project, you can see:

- `lib/source.ts`: Code for content source adapter, [`loader()`](https://fumadocs.dev/docs/headless/source-api) provides the interface to access your content.
- `app/layout.config.tsx`: Shared options for layouts, optional but preferred to keep.

| Route                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `app/(home)`              | The route group for your landing page and other pages. |
| `app/docs`                | The documentation layout and pages.                    |
| `app/api/search/route.ts` | The Route Handler for search.                          |

### Fumadocs MDX

A `source.config.ts` config file has been included, you can customise different options like frontmatter schema.

Read the [Introduction](https://fumadocs.dev/docs/mdx) for further details.

## Learn More

To learn more about Next.js and Fumadocs, take a look at the following
resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js
  features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Fumadocs](https://fumadocs.vercel.app) - learn about Fumadocs

# SaaS Maker Utils Documentation

This is the documentation site for [SaaS Maker Utils](https://github.com/wzulfikar/saas-maker), a collection of utility functions for building SaaS applications in TypeScript/JavaScript.

## Getting Started

To run the documentation site locally:

```bash
# Install dependencies
npm install
# or
yarn
# or
bun install

# Start the development server
npm run dev
# or
yarn dev
# or
bun dev
```

The documentation will be available at [http://localhost:3000](http://localhost:3000).

## Documentation Structure

The documentation is organized as follows:

- **Introduction**: Overview of SaaS Maker Utils and how to install it
- **Core Utilities**:
  - **Error Handling**: Utilities for handling errors in your application
  - **Validation**: Functions to validate inputs and throw errors when validation fails
  - **Logging**: Logging utilities for consistent logging across your application
  - **Result Type**: A result type for handling success and failure cases

## Adding New Documentation

To add new documentation:

1. Create a new `.mdx` file in the `content/docs` directory
2. Add the file to the navigation structure in `content/docs/meta.json`

## Building for Production

To build the documentation site for production:

```bash
npm run build
# or
yarn build
# or
bun build
```

The build output will be in the `.next` directory.

## Technologies

This documentation site is built with:

- [Fumadocs](https://fumadocs.dev) - Documentation framework
- [Next.js](https://nextjs.org) - React framework
- [MDX](https://mdxjs.com) - Markdown + JSX for content

## License

The documentation is licensed under the same license as the SaaS Maker Utils project.
