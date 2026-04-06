import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3001/api';

export const handlers = [
  http.get(`${API_URL}/auth/status`, () => {
    return HttpResponse.json({ requiresSetup: false });
  }),
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: 1, familyName: body.familyName, displayName: 'Test Family' },
      encryptionSalt: 'mock-salt-base64',
      encryptionEnabled: false,
    });
  }),
  http.get(`${API_URL}/auth/verify`, () => {
    return HttpResponse.json({
      user: { id: 1, familyName: 'TestFamily', displayName: 'Test Family' },
    });
  }),
  http.get(`${API_URL}/nodes`, () => {
    return HttpResponse.json([]);
  }),
  http.get(`${API_URL}/edges`, () => {
    return HttpResponse.json([]);
  }),
  http.get(`${API_URL}/images`, () => {
    return HttpResponse.json([]);
  }),
  http.get(`${API_URL}/family/settings`, () => {
    return HttpResponse.json({
      encryptionEnabled: false,
      showStreetFields: true,
      showPhoneField: true,
      showEmailField: true,
      nodeCreationLocked: false,
    });
  }),
  http.get(`${API_URL}/completion/settings`, () => {
    return HttpResponse.json({
      showMissingRequired: false,
      requireName: true,
      requireSurname: true,
      requireMaidenName: true,
      requireBirthDate: true,
      requireStreetFields: true,
      requireCityZip: true,
      requireCountry: true,
      requirePhone: true,
      requireEmail: true,
      requireTaggedImage: true,
    });
  }),
  http.get(`${API_URL}/terms/status`, () => {
    return HttpResponse.json({ needsAcceptance: false });
  }),
  http.get(`${API_URL}/terms/version`, () => {
    return HttpResponse.json({ version: 'beta-1.0' });
  }),
];
