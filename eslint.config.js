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
                // Globais do runtime Node usados pela suíte de integração.
                // Sem declará-los aqui, `no-undef` acusaria fetch e
                // URLSearchParams como indefinidos.
                fetch: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                AbortController: 'readonly',
                setTimeout: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
            'no-undef': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];
