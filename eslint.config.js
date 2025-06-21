import tseslint from 'typescript-eslint';
import globals from 'globals';
import js from '@eslint/js';

export default tseslint.config(
    // 全局忽略配置
    {
        ignores: ["dist/", "coverage/", "*.config.js", "examples/", "node_modules/", "*.js"],
    },

    // 依次应用推荐的配置集。
    // `tseslint.configs.strictTypeChecked` 包含了对 TS 文件的所有基础配置和规则。
    ...tseslint.configs.recommendedTypeChecked,
    

    // 在所有推荐规则的基础上，应用我们自己的定制化规则。
    // 这个配置块会覆盖之前的默认规则。
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            // 这里放宽一些过于严格的规则
            // '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',

            // 这里是你自定义的规则
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            
            // 代码风格规则
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'indent': ['error', 4, { SwitchCase: 1 }],
            'max-len': ['warn', { code: 120, ignoreUrls: true }],
            'no-multiple-empty-lines': ['warn', { max: 2 }],
            'eol-last': ['error', 'always'],

            // 通用规则
            'no-console': 'off',
            'no-debugger': 'error',
            'eqeqeq': ['error', 'always'],
            'curly': 'error',
        },
    }
);