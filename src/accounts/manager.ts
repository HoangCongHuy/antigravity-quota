const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export class AccountManager {
  private static instace: AccountManager | null = null;

  private constructor() {}

  static getInstance(): AccountManager {
    if (!AccountManager.instace) {
      AccountManager.instace = new AccountManager();
    }

    return AccountManager.instace;
  }

  static resetInstance() {
    AccountManager.instace = null;
  }

  getAccountEmails(): string[] {
    return listAccountEmails();
  }
}
