import Joi from 'joi';
import { logger } from './logger.js';

/**
 * 🛡️ ENVIRONMENT CONFIGURATION VALIDATOR
 * 
 * Think of this as a security guard that checks everyone has
 * the right ID cards before entering the building!
 */

const envSchema = Joi.object({
  CLAUDE_API_KEY: Joi.string().required().messages({
    'any.required': 'Claude API key is missing! Get it from https://console.anthropic.com/'
  }),
  CLAUDE_MODEL_ID: Joi.string().default('claude-3-sonnet-20240229'),
  
  ELEVENLABS_API_KEY: Joi.string().allow('').optional().messages({
    'string.empty': 'ElevenLabs API key is empty - voice features will be disabled'
  }),
  ELEVENLABS_VOICE_ID: Joi.string().default('5gBmGqdd8c8PD5xP7lPE'),
  
  SUPABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'Supabase URL is missing! Get it from your Supabase dashboard'
  }),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required().messages({
    'any.required': 'Supabase service key is missing! Get it from your Supabase dashboard'
  }),
  
  FLUTTERWAVE_SECRET_KEY: Joi.string().allow('').optional(),
  FLUTTERWAVE_HASH: Joi.string().allow('').optional(),
  
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
});

function validateEnvironment() {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: false
  });

  if (error) {
    console.error('🚨 CONFIGURATION ERROR:', error.details[0].message);
    console.log('💡 Check your environment variables in Vercel dashboard!');
    throw new Error(`Environment validation failed: ${error.details[0].message}`);
  }

  // Log what's working (without exposing secrets)
  const maskedConfig = {
    NODE_ENV: value.NODE_ENV,
    CLAUDE_MODEL: value.CLAUDE_MODEL_ID,
    HAS_CLAUDE_KEY: !!value.CLAUDE_API_KEY,
    HAS_ELEVENLABS_KEY: !!value.ELEVENLABS_API_KEY,
    HAS_SUPABASE: !!value.SUPABASE_URL,
    HAS_FLUTTERWAVE: !!value.FLUTTERWAVE_SECRET_KEY
  };

  logger.info('✅ Configuration validated successfully', maskedConfig);
  return value;
}

export const config = validateEnvironment();