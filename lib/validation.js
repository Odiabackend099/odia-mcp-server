import Joi from 'joi';

/**
 * 📝 INPUT VALIDATION SCHEMAS
 * 
 * Think of these as forms with rules - like "name must have letters,
 * email must have @, phone must have numbers" etc.
 */

// ✅ Customer info checker
export const customerInfoSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot be longer than 100 characters',
      'string.pattern.base': 'Name can only contain letters and spaces',
      'any.required': 'Name is required'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    
  phone: Joi.string()
    .pattern(/^\+?[\d\s-()]+$/)
    .min(10)
    .max(20)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number format is invalid',
      'string.min': 'Phone number must be at least 10 digits'
    }),
    
  company: Joi.string()
    .max(200)
    .optional(),
    
  message: Joi.string()
    .max(1000)
    .optional()
});

// ✅ Voice message checker
export const voiceMessageSchema = Joi.object({
  message: Joi.string()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message is too long (max 1000 characters)',
      'any.required': 'Message is required'
    }),
    
  conversationId: Joi.string()
    .alphanum()
    .max(50)
    .optional()
    .messages({
      'string.alphanum': 'Conversation ID can only contain letters and numbers'
    })
});

// ✅ Onboarding request checker
export const onboardingSchema = Joi.object({
  customerInfo: customerInfoSchema.required()
});