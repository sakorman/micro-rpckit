import tseslint from 'typescript-eslint';
import globals from 'globals';
import js from '@eslint/js';

export default tseslint.config(
    // 全局忽略配置
    {
        ignores: ["dist/", "coverage/", "*.config.js", "examples/", "node_modules/", "*.js"],
    },

    // 使用推荐配置，但不包含过于严格的类型检查
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // 自定义配置
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            // TypeScript 相关规则 - 宽松配置
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true 
            }],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/prefer-as-const': 'warn',
            
            // 关闭过于严格的类型安全规则
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/restrict-plus-operands': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            
            // 代码风格规则 - 保持基本的代码一致性
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            'indent': ['error', 4, { SwitchCase: 1 }],
            'max-len': ['warn', { 
                code: 120, 
                ignoreUrls: true, 
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreComments: true 
            }],
            'no-multiple-empty-lines': ['warn', { max: 3, maxEOF: 1 }],
            'eol-last': ['error', 'always'],
            
            // 通用规则 - 保持宽松
            'no-console': 'off',
            'no-debugger': 'warn',
            'eqeqeq': ['warn', 'always'],
            'curly': ['error', 'multi-line'],
            'no-unused-expressions': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'prefer-const': 'warn',
            'no-var': 'error',
            'object-shorthand': 'warn',
            'prefer-template': 'warn',
            
            // 关闭一些可能干扰开发的规则
            'no-prototype-builtins': 'off',
            'no-case-declarations': 'off',
            'no-constant-condition': 'off',
            'no-inner-declarations': 'off',
        },
    }
);