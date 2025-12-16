/**
 * Property-Based Tests for API Key Validation
 * Feature: standalone-desktop-app, Property 11: API key validation
 * Validates: Requirements 4.2
 */

const fc = require('fast-check');
const { validateApiKey, validateOpenAIKey, validateAnthropicKey, validateGoogleKey } = require('../api-key-validator');

describe('API Key Validation Properties', () => {
  describe('Property 11: API key validation', () => {
    test('invalid API key formats should always be rejected', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('openai'),
            fc.constant('anthropic'),
            fc.constant('google')
          ),
          fc.oneof(
            // Empty strings
            fc.constant(''),
            fc.constant('   '),
            // Random strings that don't match any format
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
              !s.startsWith('sk-') && 
              !s.startsWith('sk-ant-') && 
              !s.startsWith('AIza')
            ),
            // Invalid prefixes
            fc.constant('invalid-key'),
            fc.constant('api-key-123'),
            // Too short
            fc.constant('sk-'),
            fc.constant('sk-ant-'),
            fc.constant('AIza'),
            // Special characters only
            fc.constant('!@#$%^&*()'),
            // Null-like values converted to strings
            fc.constant('null'),
            fc.constant('undefined')
          ),
          (provider, invalidKey) => {
            const result = validateApiKey(provider, invalidKey);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            expect(typeof result.error).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid OpenAI key format should be accepted', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Legacy format: sk-[48+ chars]
            fc.tuple(
              fc.constant('sk-'),
              fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 60 })
            ).map(([prefix, suffix]) => prefix + suffix),
            // Modern format: sk-proj-[48+ chars]
            fc.tuple(
              fc.constant('sk-proj-'),
              fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 60 })
            ).map(([prefix, suffix]) => prefix + suffix)
          ),
          (validKey) => {
            const result = validateApiKey('openai', validKey);
            expect(result.valid).toBe(true);
            expect(result.error).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid Anthropic key format should be accepted', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constant('sk-ant-'),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 20, maxLength: 60 })
          ).map(([prefix, suffix]) => prefix + suffix),
          (validKey) => {
            const result = validateApiKey('anthropic', validKey);
            expect(result.valid).toBe(true);
            expect(result.error).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('valid Google key format should be accepted', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constant('AIza'),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 35, maxLength: 35 })
          ).map(([prefix, suffix]) => prefix + suffix),
          (validKey) => {
            const result = validateApiKey('google', validKey);
            expect(result.valid).toBe(true);
            expect(result.error).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('non-string values should be rejected', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('openai'),
            fc.constant('anthropic'),
            fc.constant('google')
          ),
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.integer(),
            fc.boolean(),
            fc.object(),
            fc.array(fc.string())
          ),
          (provider, nonStringValue) => {
            const result = validateApiKey(provider, nonStringValue);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unknown providers should be rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
            !['openai', 'anthropic', 'google'].includes(s.toLowerCase())
          ),
          fc.string({ minLength: 10, maxLength: 50 }),
          (unknownProvider, key) => {
            const result = validateApiKey(unknownProvider, key);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Unknown provider');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('keys with correct prefix but insufficient length should be rejected', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.tuple(fc.constant('openai'), fc.constant('sk-'), fc.stringOf(fc.char(), { minLength: 0, maxLength: 19 })),
            fc.tuple(fc.constant('anthropic'), fc.constant('sk-ant-'), fc.stringOf(fc.char(), { minLength: 0, maxLength: 19 })),
            fc.tuple(fc.constant('google'), fc.constant('AIza'), fc.stringOf(fc.char(), { minLength: 0, maxLength: 34 }))
          ),
          ([provider, prefix, suffix]) => {
            const shortKey = prefix + suffix;
            const result = validateApiKey(provider, shortKey);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Individual validator functions', () => {
    test('validateOpenAIKey rejects invalid formats', () => {
      expect(validateOpenAIKey('')).toBe(false);
      expect(validateOpenAIKey(null)).toBe(false);
      expect(validateOpenAIKey(undefined)).toBe(false);
      expect(validateOpenAIKey('sk-')).toBe(false);
      expect(validateOpenAIKey('invalid')).toBe(false);
    });

    test('validateAnthropicKey rejects invalid formats', () => {
      expect(validateAnthropicKey('')).toBe(false);
      expect(validateAnthropicKey(null)).toBe(false);
      expect(validateAnthropicKey(undefined)).toBe(false);
      expect(validateAnthropicKey('sk-ant-')).toBe(false);
      expect(validateAnthropicKey('invalid')).toBe(false);
    });

    test('validateGoogleKey rejects invalid formats', () => {
      expect(validateGoogleKey('')).toBe(false);
      expect(validateGoogleKey(null)).toBe(false);
      expect(validateGoogleKey(undefined)).toBe(false);
      expect(validateGoogleKey('AIza')).toBe(false);
      expect(validateGoogleKey('invalid')).toBe(false);
    });
  });
});
