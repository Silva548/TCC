const js = require('@eslint/js');

module.exports = [
    {
        ignores: ['node_modules/', 'views/'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'writable',
                __dirname: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
            'no-undef': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];
