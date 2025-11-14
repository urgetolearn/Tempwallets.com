/** @type {import('next').NextConfig} */
const nextConfig = {
	env: {
		MIXPANEL_TOKEN: process.env.MIXPANEL_TOKEN,
		MIXPANEL_TOKEN_DEV: process.env.MIXPANEL_TOKEN_DEV,
	},
};

export default nextConfig;
