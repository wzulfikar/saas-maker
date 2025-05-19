import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
import { z } from 'zod';

// Customize the frontmatter schema
const customFrontmatterSchema = frontmatterSchema.extend({
  description: z.string().optional(),
});

// Define the docs structure
export const docs = defineDocs({
  docs: {
    schema: customFrontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // MDX options for syntax highlighting, etc.
    remarkPlugins: [],
    rehypePlugins: [],
  },
});
