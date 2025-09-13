// Test script to verify webhook variable parsing
const testPayload = {
  repository: {
    id: 123456,
    name: 'Portfolio.me',
    full_name: 'Harshvardhan-91/Portfolio.me',
    html_url: 'https://github.com/Harshvardhan-91/Portfolio.me'
  },
  pusher: {
    name: 'Harshvardhan-91',
    email: 'harshvardhan@example.com'
  },
  head_commit: {
    id: 'abc123def456',
    message: 'Fix responsive design issues and update contact form',
    author: {
      name: 'Harshvardhan-91',
      email: 'harshvardhan@example.com'
    },
    url: 'https://github.com/Harshvardhan-91/Portfolio.me/commit/abc123def456'
  },
  commits: [
    {
      id: 'abc123def456',
      message: 'Fix responsive design issues and update contact form',
      author: {
        name: 'Harshvardhan-91',
        email: 'harshvardhan@example.com'
      },
      url: 'https://github.com/Harshvardhan-91/Portfolio.me/commit/abc123def456'
    }
  ],
  ref: 'refs/heads/main'
};

// Test templates
const templates = [
  '⚡ **{{payload.repository.name}}** updated 📝\n{{payload.head_commit.message}} 👤 By {{payload.pusher.name}}\n🔗 {{payload.head_commit.url}}',
  '🚀 **New push to {{repository_name}}**\n\n👤 **Author:** {{author_name}}\n📝 **Commit:** {{payload.head_commit.message}}\n🌿 **Branch:** {{payload.ref}}\n\n🔗 [View Changes]({{payload.head_commit.url}})',
  '📢 **{{payload.repository.name}}** updated by **{{payload.pusher.name}}**\n\n💡 **Changes:** {{payload.head_commit.message}}\n🔗 {{payload.head_commit.url}}'
];

// Simple variable replacement function (mimicking the backend logic)
function buildSlackMessage(template, payload) {
  const headCommit = payload.head_commit || 
    (payload.commits && payload.commits.length > 0 
      ? payload.commits[payload.commits.length - 1] 
      : null);

  let message = template
    .replace(/\{\{repository_name\}\}/g, payload.repository.name)
    .replace(/\{\{author_name\}\}/g, payload.pusher.name)
    .replace(/\{\{payload\.repository\.name\}\}/g, payload.repository.name)
    .replace(/\{\{payload\.repository\.full_name\}\}/g, payload.repository.full_name)
    .replace(/\{\{payload\.pusher\.name\}\}/g, payload.pusher.name)
    .replace(/\{\{payload\.ref\}\}/g, payload.ref?.replace('refs/heads/', '') || 'main')
    .replace(/\{\{payload\.head_commit\.message\}\}/g, headCommit?.message || 'No commit message')
    .replace(/\{\{payload\.head_commit\.url\}\}/g, headCommit?.url || payload.repository.html_url)
    .replace(/\{\{payload\.head_commit\.author\.name\}\}/g, headCommit?.author?.name || payload.pusher.name);

  return message;
}

console.log('🧪 Testing Webhook Variable Parsing\n');
console.log('📦 Test Payload:');
console.log(`Repository: ${testPayload.repository.name}`);
console.log(`Author: ${testPayload.pusher.name}`);
console.log(`Commit: ${testPayload.head_commit.message}`);
console.log(`URL: ${testPayload.head_commit.url}\n`);

templates.forEach((template, index) => {
  console.log(`📝 Template ${index + 1}:`);
  console.log(`Input: ${template}`);
  console.log(`Output: ${buildSlackMessage(template, testPayload)}`);
  console.log('---\n');
});