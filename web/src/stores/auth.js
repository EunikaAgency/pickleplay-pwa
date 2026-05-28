import { create } from 'zustand';

const useAuth = create((set) => ({
  user: JSON.parse(localStorage.getItem('pickleballer_user')),
  isLoggedIn: !!localStorage.getItem('pickleballer_user'),

  login: (email) => {
    const user = {
      id: 'usr_dev',
      email: email || 'dev@pickleballer.xyz',
      firstName: 'Alex',
      lastName: 'Player',
      avatar: 'https://i.pravatar.cc/150?u=alex',
      skillLevel: 3.5,
      skillLabel: 'Intermediate',
      role: 'user',
    };
    localStorage.setItem('pickleballer_user', JSON.stringify(user));
    set({ user, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem('pickleballer_user');
    set({ user: null, isLoggedIn: false });
  },
}));

export default useAuth;
