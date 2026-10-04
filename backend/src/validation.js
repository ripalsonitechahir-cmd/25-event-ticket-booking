const { z } = require('zod');

const bookingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email is too long')
    .email('A valid email is required'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(10, 'You can book at most 10 tickets at once'),
});

const eventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  venue: z.string().trim().min(1, 'Venue is required').max(150),
  event_date: z.coerce
    .date({ invalid_type_error: 'A valid event date is required' })
    .refine((d) => d.getTime() > Date.now(), 'Event date must be in the future'),
  price: z.coerce.number().min(0, 'Price cannot be negative').max(100000),
  total_seats: z.coerce
    .number()
    .int('Seats must be a whole number')
    .min(1, 'At least 1 seat is required')
    .max(100000),
});

const lookupSchema = z.object({
  code: z.string().trim().min(1).max(50),
  email: z
    .string({ required_error: 'Email is required', invalid_type_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('A valid email is required'),
});

module.exports = { bookingSchema, eventSchema, lookupSchema };
