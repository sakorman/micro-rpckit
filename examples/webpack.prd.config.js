const fs = require('fs');
const path = require('path');

module.exports = {
    devtool: 'source-map',
    entry: fs.readdirSync(__dirname).reduce((entries, dir) => {
        const fullDir = path.join(__dirname, dir);
        const entry = path.join(fullDir, 'index.ts');
        if (fs.statSync(fullDir).isDirectory() && fs.existsSync(entry)) {
            entries[dir] = [entry];
        }

        return entries;
    }, {}),

    output: {
        path: path.join(__dirname, '../examples/__build__'),
        filename: '[name].js',
        chunkFilename: '[id].chunk.js',
        publicPath: '/__build__/',
    },

    module: {
        rules: [
            { test: /\.js$/, exclude: /node_modules/, use: ['babel-loader'] },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
            {
                test: /\.less$/,
                use: ['style-loader', 'css-loader', 'less-loader'],
            },
            { test: /\.tsx?$/, exclude: /node_modules/, use: ['ts-loader'] },
        ],
    },

    resolve: {
        alias: {
            'rpckit': path.resolve(__dirname, '../src/index.ts'),
        },
        extensions: ['.js', '.ts', '.d.ts', '.tsx', '.css'],
    },

    optimization: {
        splitChunks: {
            cacheGroups: {
                vendors: {
                    name: 'shared',
                    filename: 'shared.js',
                    chunks: 'initial',
                },
            },
        },
    },

    plugins: [
    ],
};

