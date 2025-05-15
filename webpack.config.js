const path = require('path');

module.exports = [
    {
        entry: './blockEditor/blockEditor.ts', // Entry point for blockEditor
        output: {
            filename: 'blockEditor.js', // Output file
            path: path.resolve(__dirname, 'out/blockEditor'), // Match the output directory
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
                            configFile: path.resolve(__dirname, 'tsconfig.blockEditor.json'), // Use the correct tsconfig file
                        },
                    },
                    exclude: /node_modules/,
                },
            ],
        },
        mode: 'development', // Use 'production' for optimized builds
        devtool: 'source-map', // Generate source maps for debugging
    },
    {
        entry: './blockPropertiesEditor/blockPropertiesEditor.ts', // Entry point for blockPropertiesEditor
        output: {
            filename: 'blockPropertiesEditor.js', // Output file
            path: path.resolve(__dirname, 'out/blockPropertiesEditor'), // Match the output directory
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
                            configFile: path.resolve(__dirname, 'tsconfig.blockPropertiesEditor.json'), // Use the new tsconfig file
                        },
                    },
                    exclude: /node_modules/,
                },
            ],
        },
        mode: 'development', // Use 'production' for optimized builds
        devtool: 'source-map', // Generate source maps for debugging
    },
];