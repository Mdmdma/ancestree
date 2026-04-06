const request = require('supertest');

const defaultRegistration = {
  familyName: 'TestFamily',
  password: 'testpass123',
  adminPassword: 'adminpass123',
  adminEmail: 'test@example.com',
  displayName: 'Test Family',
  termsAccepted: true,
  termsVersion: 'beta-1.0'
};

async function registerFamily(app, overrides = {}) {
  const data = { ...defaultRegistration, ...overrides };
  const res = await request(app)
    .post('/api/auth/register')
    .send(data);
  return res;
}

async function loginFamily(app, familyName, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ familyName, password });
  return res;
}

function getAuthHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createAuthenticatedAgent(app, overrides = {}) {
  const regRes = await registerFamily(app, overrides);
  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${regRes.status} ${JSON.stringify(regRes.body)}`);
  }
  const token = regRes.body.token;
  return { token, headers: getAuthHeaders(token), user: regRes.body.user, body: regRes.body };
}

module.exports = { registerFamily, loginFamily, getAuthHeaders, createAuthenticatedAgent, defaultRegistration };
