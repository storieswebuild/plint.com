import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    category: z.enum(['Press', 'Industry', 'Stories', 'Events']).default('Stories'),
    tags: z.array(z.string()).default([]),
    hero: z.string().optional(),
    excerpt: z.string().optional(),
  }),
});

export const collections = { news };
