const path = require('path');

module.exports = {
    entry: './media/blockEditor.ts', // Entry point for your TypeScript file
    output: {
        filename: 'blockEditor.js', // Output file
        path: path.resolve(__dirname, 'out/client'), // Match the output directory
    },
    resolve: {
        extensions: ['.ts', '.js'], // Resolve TypeScript and JavaScript files
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: path.resolve(__dirname, 'tsconfig.client.json'), // Use the correct tsconfig file
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    mode: 'development', // Use 'production' for optimized builds
    devtool: 'source-map', // Generate source maps for debugging
};