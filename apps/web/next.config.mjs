/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    transpilePackages: ['ol'],
    async redirects() {
        return [
            {
                source: '/',
                destination: '/current/sar/user/search',
                permanent: false,
            },
        ];
    },
};

export default nextConfig;
