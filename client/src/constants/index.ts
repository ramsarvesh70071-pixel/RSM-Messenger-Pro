export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const QUICK_DEMO_USERS = [
  { name: 'Ramsarvesh Maurya (Admin)', phone: '+919876543210' },
  { name: 'Aarav Sharma (Dev)', phone: '+919876543211' },
  { name: 'Priya Patel (Design)', phone: '+919876543212' },
  { name: 'Rohan Verma (PM)', phone: '+919876543213' }
];

export const getInitialsAvatar = (name: string): string => {
  const safeName = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${safeName}&background=075E54&color=fff&size=150`;
};

export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect fill="%23202c33" width="150" height="150"/><text fill="%238696a0" font-family="sans-serif" font-size="60" font-weight="bold" x="50%" y="54%" dominant-baseline="middle" text-anchor="middle">U</text></svg>';
