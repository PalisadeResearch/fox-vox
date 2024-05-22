import * as path from 'path';

export default {
    entry: {
        popup: './popup.js',
        contentScript: './contentScript.js',
    },
    output: {
        filename: '[name].main.js',
        path: path.resolve(process.cwd(), 'dist'),
    },
    devtool: 'inline-source-map'
};