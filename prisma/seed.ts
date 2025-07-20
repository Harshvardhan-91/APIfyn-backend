import { PrismaClient, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear existing plans
  await prisma.plan.deleteMany();
  
  // Create subscription plans
  const plans = [
    {
      name: 'Starter',
      type: SubscriptionTier.FREE,
      description: 'Perfect for individuals getting started with automation workflows.',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        'Up to 100 API calls per month',
        '5 automation workflows',
        'Basic integrations (10+ apps)',
        'Email notifications',
        'Community support',
        'Standard templates'
      ],
      apiCallsLimit: 100,
      workflowsLimit: 5
    },
    {
      name: 'Professional',
      type: SubscriptionTier.PROFESSIONAL,
      description: 'Advanced automation for growing teams and businesses.',
      monthlyPrice: 2000, // $20.00
      yearlyPrice: 19200, // $192.00 ($16/month)
      features: [
        'Up to 10,000 API calls per month',
        'Unlimited automation workflows',
        'Premium integrations (100+ apps)',
        'Real-time monitoring & alerts',
        'Priority email support',
        'Custom workflow templates',
        'Advanced analytics dashboard',
        'Webhook support'
      ],
      apiCallsLimit: 10000,
      workflowsLimit: -1 // unlimited
    },
    {
      name: 'Enterprise',
      type: SubscriptionTier.ENTERPRISE,
      description: 'Complete automation solution for large-scale operations.',
      monthlyPrice: 3000, // $30.00
      yearlyPrice: 30000, // $300.00
      features: [
        'Unlimited API calls',
        'Advanced workflow automation',
        'All premium integrations + custom APIs',
        '24/7 dedicated support',
        'Custom onboarding & training',
        'Advanced security & compliance',
        'White-label options',
        'SLA guarantees'
      ],
      apiCallsLimit: -1, // unlimited
      workflowsLimit: -1 // unlimited
    }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan
    });
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
