/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  // Transpile Supabase packages
  transpilePackages: ['@supabase/ssr'],
  // External packages for server-side rendering
  serverExternalPackages: ['@supabase/supabase-js'],
  // Use webpack for build (Turbopack is default in dev mode)
  webpack: (config, { isServer }) => {
    // Fix for Supabase ESM modules
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs'],
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
      { message: /does not contain a default export/ },
    ]

    return config
  },
}

module.exports = nextConfig

