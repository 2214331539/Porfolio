import { authStorage, http } from '../../../shared/api/http-client';

type LoginResponse = { access_token: string; token_type: string };

export const authApi = {
  isAuthenticated: () => Boolean(authStorage.getToken()),
  async login(username: string, password: string) {
    const session = await http<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    authStorage.setToken(session.access_token);
  },
  logout: authStorage.clearToken,
};

