import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node20',
    clean: true,
    sourcemap: true,
    dts: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
    shims: true,
})