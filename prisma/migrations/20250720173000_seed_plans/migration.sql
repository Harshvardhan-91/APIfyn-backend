-- Insert initial subscription plans
INSERT INTO "plans" ("id", "name", "description", "monthlyPrice", "yearlyPrice", "features", "apiCallsLimit", "workflowsLimit", "type", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(), 
    'Starter',
    'Perfect for individuals getting started with automation workflows.',
    0,
    0,
    ARRAY[
      'Up to 100 API calls per month',
      '5 automation workflows',
      'Basic integrations (10+ apps)',
      'Email notifications',
      'Community support',
      'Standard templates'
    ],
    100,
    5,
    'STARTER',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Professional',
    'Advanced automation for growing teams and businesses.',
    2000,
    19200,
    ARRAY[
      'Up to 10,000 API calls per month',
      'Unlimited automation workflows',
      'Premium integrations (100+ apps)',
      'Real-time monitoring & alerts',
      'Priority email support',
      'Custom workflow templates',
      'Advanced analytics dashboard',
      'Webhook support'
    ],
    10000,
    -1,
    'PROFESSIONAL',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Enterprise',
    'Complete automation solution for large-scale operations.',
    3000,
    30000,
    ARRAY[
      'Unlimited API calls',
      'Advanced workflow automation',
      'All premium integrations + custom APIs',
      '24/7 dedicated support',
      'Custom onboarding & training',
      'Advanced security & compliance',
      'White-label options',
      'SLA guarantees'
    ],
    -1,
    -1,
    'ENTERPRISE',
    NOW(),
    NOW()
  )
ON CONFLICT (name) DO UPDATE 
SET 
  "description" = EXCLUDED.description,
  "monthlyPrice" = EXCLUDED.monthlyPrice,
  "yearlyPrice" = EXCLUDED.yearlyPrice,
  "features" = EXCLUDED.features,
  "apiCallsLimit" = EXCLUDED.apiCallsLimit,
  "workflowsLimit" = EXCLUDED.workflowsLimit,
  "type" = EXCLUDED.type,
  "updatedAt" = NOW();
