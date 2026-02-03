export function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 10) return '***';
  const first = token.slice(0, 6);
  const last = token.slice(-4);
  return `${first}...${last}`;
}

export function maskEmail(email: string): string {
  if (!email) return '';

  const [local, domain] = email.split('@');
  if (!domain) return email;

  if (local.length <= 2) {
    return `${local[0] || ''}**@${domain}`;
  }

  return `${local.slice(0, 2)}**@${domain}`;
}
