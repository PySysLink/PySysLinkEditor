const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = [
    {
        entry: './blockEditor/blockEditor.ts', // Entry point for blockEditor
        output: {
            filename: 'blockEditor.js', // Output file
            path: path.resolve(__dirname, 'out/blockEditor'), // Match the output directory
        },
        resolve: {
            extensions: ['.ts', '.js'], // Resolve TypeScript and JavaScript files
            alias: {
                shared: path.resolve(__dirname, "shared"), // Add alias for shared directory
            },
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
            alias: {
                shared: path.resolve(__dirname, "shared"), // Add alias for shared directory
            },
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
    {
        entry: './simulationManager/simulationManager.ts', // Entry point for blockPropertiesEditor
        output: {
            filename: 'simulationManager.js', // Output file
            path: path.resolve(__dirname, 'out/simulationManager'), // Match the output directory
        },
        resolve: {
            extensions: ['.ts', '.js'], // Resolve TypeScript and JavaScript files
            alias: {
                shared: path.resolve(__dirname, "shared"), // Add alias for shared directory
            },
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            configFile: path.resolve(__dirname, 'tsconfig.simulationManager.json'), // Use the new tsconfig file
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
        name: 'extension',
        target: 'node',                        // VS Code’s extension host is Node.js
        entry: './src/extension.ts',     // point at your TS entry
        output: {
            path: path.resolve(__dirname, 'out'),
            filename: 'extension.bundle.js',
            libraryTarget: 'commonjs2',          // required for VS Code
        },
        resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            shared: path.resolve(__dirname, 'shared'),
        }
        },
        module: {
        rules: [
            {
            test: /\.ts$/,
            use: [
                {
                    loader: 'ts-loader',
                    options: {
                        configFile: path.resolve(__dirname, 'tsconfig.server.json'),
                    },
                }
            ],
            exclude: /node_modules/
            }
        ]
        },
        externals: {
        // don’t bundle the built‑in vscode API
        vscode: 'commonjs vscode'
        },
        devtool: 'source-map',
        plugins: [
            new CopyPlugin({
            patterns: [
                {
                from: path.resolve(__dirname, 'src', 'pysyslink_server'),
                to: path.resolve(__dirname, 'out', 'pysyslink_server')
                }
            ]
            })
        ]

    }
];