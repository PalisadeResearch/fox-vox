import * as path from 'path';

export default {
    entry: {
        popup: './popup.js',    // Your current main entry point
        contentScript: './contentScript.js', // Your new entry point
    },
    output: {
        filename: '[name].main.js',
        path: path.resolve(process.cwd(), 'dist'),
    },
    devtool: 'inline-source-map'
};