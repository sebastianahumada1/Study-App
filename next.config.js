/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  // Set output file tracing root to current directory
  outputFileTracingRoot: path.join(__dirname),
  // Transpile Supabase packages
  transpilePackages: ['@supabase/ssr'],
  // External packages for server-side rendering - use CommonJS version
  // Note: @supabase/ssr is in transpilePackages, so don't include it here
  serverExternalPackages: ['@supabase/supabase-js'],
  // Use webpack for build (Turbopack is default in dev mode)
  webpack: (config, { isServer }) => {
    // Fix for Supabase ESM modules
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs'],
    }
    
    // Prefer CommonJS over ESM for Supabase in server-side
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Force use of main (CommonJS) build instead of module (ESM)
        // This prevents Vercel from using the ESM module which causes "Cannot use import statement outside a module"
        '@supabase/supabase-js': path.resolve(
          __dirname,
          'node_modules/@supabase/supabase-js/dist/main/index.js'
        ),
      }
      
      // Also configure resolve.mainFields to prefer 'main' over 'module'
      config.resolve.mainFields = ['main', 'module']
    }
    
    // Handle ESM modules from Supabase
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    })

    // Ignore warnings for known Supabase/Next.js 16 compatibility issues
    config.ignoreWarnings = [
      { module: /node_modules\/@supabase\/supabase-js\/dist\/esm\/wrapper\.mjs/ },
      { module: /node_modules\/@supabase\/supabase-js\/dist\/module/ },
      { message: /does not contain a default export/ },
      { message: /The "middleware" file convention is deprecated/ }, // Ignore middleware warning
    ]

    return config
  },
}

module.exports = nextConfig

